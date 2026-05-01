import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@qdash.app';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Q-Dash111_2005';
const ADMIN_USER_ID = process.env.ADMIN_USER_ID || 'c6ae1256-0bda-4a98-8fcc-8765446f9d32';
const SESSION_SECRET = process.env.SESSION_SECRET || 'replace-with-a-strong-secret';
const COOKIE_NAME = 'qid_admin';
const COOKIE_MAX_AGE = 8 * 60 * 60 * 1000; // 8 hours

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY is not set. Admin API routes will fail.');
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  },
  global: {
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'apikey': SUPABASE_SERVICE_ROLE_KEY
    }
  }
});

function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(';').map((cookie) => {
      const [name, ...rest] = cookie.trim().split('=');
      return [name, decodeURIComponent(rest.join('='))];
    })
  );
}

function createSessionToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [body, signature] = parts;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');

  try {
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function requireAdmin(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[COOKIE_NAME];
  const session = verifySessionToken(token);

  if (!session) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (session.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  req.adminUser = session;
  next();
}

app.use(express.json());

app.post('/api/login', async (req, res) => {
  const { passkey } = req.body || {};

  if (!passkey) {
    return res.status(400).json({ error: 'Passkey is required.' });
  }

  if (passkey !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid passkey.' });
  }

  // Ensure admin user exists in profiles table
  try {
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', ADMIN_USER_ID)
      .single();

    if (!existingProfile) {
      const { error: insertError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: ADMIN_USER_ID,
          email: ADMIN_EMAIL,
          role: 'admin'
        });

      if (insertError) {
        console.error('Failed to create admin profile:', insertError);
        // Continue anyway - the profile might not be strictly required
      }
    }
  } catch (error) {
    console.error('Error checking/creating admin profile:', error);
    // Continue with login
  }

  const user = {
    id: ADMIN_USER_ID,
    email: ADMIN_EMAIL,
    role: 'admin'
  };
  const token = createSessionToken(user);

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/'
  });

  return res.json({ user });
});

app.post('/api/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  return res.json({ success: true });
});

app.get('/api/me', (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[COOKIE_NAME];
  const session = verifySessionToken(token);

  if (!session) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  return res.json({ user: session });
});

app.get('/api/admin/surveys', requireAdmin, async (req, res) => {
  try {
    console.log('Loading surveys for admin:', req.adminUser.id, req.adminUser.email);
    
    const { data, error } = await supabaseAdmin
      .from('surveys')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error loading surveys:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log('Surveys loaded:', data?.length || 0, 'surveys found');
    if (data && data.length > 0) {
      console.log('First survey:', { id: data[0].id, title: data[0].title, admin_id: data[0].admin_id });
    }

    return res.json({ surveys: data || [] });
  } catch (error) {
    console.error('Admin surveys load failed:', error);
    return res.status(500).json({ error: 'Unable to load admin surveys.' });
  }
});

app.get('/api/admin/surveys/:surveyId', requireAdmin, async (req, res) => {
  const surveyId = req.params.surveyId;

  try {
    const { data: survey, error: surveyError } = await supabaseAdmin
      .from('surveys')
      .select('*')
      .eq('id', surveyId)
      .single();

    if (surveyError || !survey) {
      return res.status(404).json({ error: 'Survey not found.' });
    }

    const { data: questions, error: questionsError } = await supabaseAdmin
      .from('questions')
      .select('*')
      .eq('survey_id', surveyId)
      .eq('is_active', true)
      .order('order_index', { ascending: true });

    if (questionsError) {
      return res.status(500).json({ error: questionsError.message });
    }

    return res.json({ survey, questions: questions || [] });
  } catch (error) {
    console.error('Admin survey load failed:', error);
    return res.status(500).json({ error: 'Unable to load survey.' });
  }
});

app.post('/api/admin/surveys', requireAdmin, async (req, res) => {
  const { title, description, questions } = req.body || {};

  console.log('Creating survey:', { title, adminId: req.adminUser.id, questionCount: questions?.length });

  if (!title || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: 'Survey title and questions are required.' });
  }

  try {
    const { data: survey, error: surveyError } = await supabaseAdmin
      .from('surveys')
      .insert({
        title,
        description,
        admin_id: req.adminUser.id,
        status: 'open',
        total_responses: 0,
        theme: req.body.theme || 'default',
        font_family: req.body.font_family || 'default',
        theme_color: req.body.theme_color || null,
        logo_url: req.body.logo_url || null,
        default_language: req.body.default_language || null,
        supported_languages: req.body.supported_languages || null,
        open_date: req.body.open_date || null,
        close_date: req.body.close_date || null
      })
      .select()
      .single();

    if (surveyError || !survey) {
      return res.status(500).json({ error: surveyError?.message || 'Failed to create survey.' });
    }

    const questionRows = questions.map((q) => ({
      id: q.id,
      survey_id: survey.id,
      question_group_id: q.id,
      version: 1,
      is_active: true,
      type: q.type,
      question_text: q.question_text,
      options: q.type === 'text' ? null : q.options,
      required: q.required,
      order_index: q.order_index,
      show_when_question_id: q.show_when_question_id || null,
      show_when_answer_value: q.show_when_answer_value || null
    }));

    const { error: questionError } = await supabaseAdmin
      .from('questions')
      .insert(questionRows);

    if (questionError) {
      console.error('Question insert failed:', questionError);
      await supabaseAdmin.from('surveys').delete().eq('id', survey.id);
      return res.status(500).json({ error: questionError.message });
    }

    console.log('Survey created successfully:', survey.id, 'admin_id:', survey.admin_id, 'status:', survey.status);
    
    // Verify it can be loaded immediately
    const { data: verifySurvey, error: verifyError } = await supabaseAdmin
      .from('surveys')
      .select('id, title, admin_id, status')
      .eq('id', survey.id)
      .maybeSingle();
    
    if (verifyError) {
      console.error('Verification load FAILED:', verifyError);
    } else if (verifySurvey) {
      console.log('Verification load SUCCESS:', verifySurvey);
    } else {
      console.error('CRITICAL: Survey created but cannot be verified - may be invisible!');
    }
    
    return res.json({ survey });
  } catch (error) {
    console.error('Admin survey create failed:', error);
    return res.status(500).json({ error: 'Unable to create survey.' });
  }
});

app.put('/api/admin/surveys/:surveyId', requireAdmin, async (req, res) => {
  const surveyId = req.params.surveyId;
  const { title, description, questions } = req.body || {};

  if (!title || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: 'Survey title and questions are required.' });
  }

  try {
    const { data: survey, error: surveyError } = await supabaseAdmin
      .from('surveys')
      .update({
        title,
        description,
        theme: req.body.theme || 'default',
        font_family: req.body.font_family || 'default',
        theme_color: req.body.theme_color || null,
        logo_url: req.body.logo_url || null,
        default_language: req.body.default_language || null,
        supported_languages: req.body.supported_languages || null,
        open_date: req.body.open_date || null,
        close_date: req.body.close_date || null
      })
      .eq('id', surveyId)
      .select()
      .single();

    if (surveyError || !survey) {
      return res.status(404).json({ error: surveyError?.message || 'Survey not found.' });
    }

    const { data: existingQuestions = [], error: existingQuestionsError } = await supabaseAdmin
      .from('questions')
      .select('id, question_group_id, type, question_text, options, required, order_index, version, is_active')
      .eq('survey_id', surveyId);

    if (existingQuestionsError) {
      return res.status(500).json({ error: existingQuestionsError.message });
    }

    const { data: responseRows, error: responseRowsError } = await supabaseAdmin
      .from('responses')
      .select('question_id')
      .eq('survey_id', surveyId);

    if (responseRowsError) {
      return res.status(500).json({ error: responseRowsError.message });
    }

    const responseCountByQuestion = new Map();
    (responseRows || []).forEach((row) => {
      const key = row.question_id;
      responseCountByQuestion.set(key, (responseCountByQuestion.get(key) || 0) + 1);
    });

    const existingQuestionMap = new Map(existingQuestions.map((q) => [q.id, q]));
    const activeIncomingIds = questions.map((q) => q.id);
    const questionsToDeactivate = existingQuestions
      .filter((q) => q.is_active && !activeIncomingIds.includes(q.id))
      .map((q) => q.id);

    const questionsToInsert = [];
    const questionsToUpdate = [];

    const questionHasChanged = (existing, incoming) => {
      if (!existing) return true;
      return (
        existing.question_text !== incoming.question_text ||
        existing.type !== incoming.type ||
        existing.required !== incoming.required ||
        existing.order_index !== incoming.order_index ||
        existing.show_when_question_id !== incoming.show_when_question_id ||
        existing.show_when_answer_value !== incoming.show_when_answer_value ||
        JSON.stringify(existing.options || []) !== JSON.stringify(incoming.options || [])
      );
    };

    for (const q of questions) {
      const existing = existingQuestionMap.get(q.id);
      const existingCount = responseCountByQuestion.get(q.id) || 0;
      const changed = questionHasChanged(existing, q);

      if (existing) {
        if (existingCount > 0 && changed) {
          questionsToDeactivate.push(existing.id);
          questionsToInsert.push({
            id: crypto.randomUUID(),
            survey_id: surveyId,
            question_group_id: existing.question_group_id || existing.id,
            version: (existing.version || 1) + 1,
            is_active: true,
            type: q.type,
            question_text: q.question_text,
            options: q.type === 'text' ? null : q.options,
            required: q.required,
            order_index: q.order_index,
            show_when_question_id: q.show_when_question_id || null,
            show_when_answer_value: q.show_when_answer_value || null
          });
        } else {
          questionsToUpdate.push({
            id: existing.id,
            question_text: q.question_text,
            type: q.type,
            options: q.type === 'text' ? null : q.options,
            required: q.required,
            order_index: q.order_index,
            is_active: true,
            show_when_question_id: q.show_when_question_id || null,
            show_when_answer_value: q.show_when_answer_value || null
          });
        }
      } else {
        questionsToInsert.push({
          id: q.id,
          survey_id: surveyId,
          question_group_id: q.id,
          version: 1,
          is_active: true,
          type: q.type,
          question_text: q.question_text,
          options: q.type === 'text' ? null : q.options,
          required: q.required,
          order_index: q.order_index,
          show_when_question_id: q.show_when_question_id || null,
          show_when_answer_value: q.show_when_answer_value || null
        });
      }
    }

    if (questionsToDeactivate.length > 0) {
      const { error: deactivateError } = await supabaseAdmin
        .from('questions')
        .update({ is_active: false })
        .in('id', questionsToDeactivate);

      if (deactivateError) {
        return res.status(500).json({ error: deactivateError.message });
      }
    }

    await Promise.all(questionsToUpdate.map((q) =>
      supabaseAdmin.from('questions').update({
        question_text: q.question_text,
        type: q.type,
        options: q.options,
        required: q.required,
        order_index: q.order_index,
        is_active: q.is_active
      }).eq('id', q.id)
    ));

    if (questionsToInsert.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('questions')
        .insert(questionsToInsert);

      if (insertError) {
        return res.status(500).json({ error: insertError.message });
      }
    }

    return res.json({ survey });
  } catch (error) {
    console.error('Admin survey update failed:', error);
    return res.status(500).json({ error: 'Unable to update survey.' });
  }
});

app.delete('/api/admin/surveys/:surveyId', requireAdmin, async (req, res) => {
  const surveyId = req.params.surveyId;
  console.log('Deleting survey:', surveyId, 'by admin:', req.adminUser.id);

  try {
    // First check if survey exists and belongs to this admin
    const { data: survey, error: checkError } = await supabaseAdmin
      .from('surveys')
      .select('id, title, admin_id')
      .eq('id', surveyId)
      .maybeSingle();

    if (checkError) {
      console.error('Survey lookup failed:', checkError);
      return res.status(500).json({ error: checkError.message });
    }

    if (!survey) {
      console.log('Survey already deleted or not found:', surveyId);
      return res.status(404).json({ error: 'Survey not found or already deleted' });
    }

    console.log('Found survey to delete:', survey);

    // Delete related responses first (cascade)
    const { error: responsesError } = await supabaseAdmin
      .from('responses')
      .delete()
      .eq('survey_id', surveyId);

    if (responsesError) {
      console.error('Failed to delete responses:', responsesError);
    } else {
      console.log('Deleted responses for survey:', surveyId);
    }

    // Delete related questions
    const { error: questionsError } = await supabaseAdmin
      .from('questions')
      .delete()
      .eq('survey_id', surveyId);

    if (questionsError) {
      console.error('Failed to delete questions:', questionsError);
      return res.status(500).json({ error: 'Failed to delete questions: ' + questionsError.message });
    }

    console.log('Deleted questions for survey:', surveyId);

    // Finally delete the survey using RPC for guaranteed execution
    console.log('Executing survey delete for:', surveyId);
    
    const { error: deleteError } = await supabaseAdmin
      .from('surveys')
      .delete()
      .eq('id', surveyId);

    if (deleteError) {
      console.error('Survey delete failed:', deleteError);
      return res.status(500).json({ error: deleteError.message });
    }

    console.log('Delete query executed for:', surveyId);

    // CRITICAL: Verify deletion immediately
    const { data: verifyData, error: verifyError } = await supabaseAdmin
      .from('surveys')
      .select('id, title')
      .eq('id', surveyId)
      .maybeSingle();

    if (verifyError) {
      console.error('Verification query failed:', verifyError);
      return res.status(500).json({ error: 'Failed to verify deletion: ' + verifyError.message });
    }

    if (verifyData) {
      console.error('CRITICAL P0 FAILURE: Survey still exists after delete!', verifyData);
      
      // Attempt force delete via raw query as fallback
      const { error: rpcError } = await supabaseAdmin.rpc('force_delete_survey', {
        survey_id: surveyId
      });
      
      if (rpcError) {
        console.error('Force delete RPC also failed:', rpcError);
        return res.status(500).json({ 
          error: 'CRITICAL: Survey could not be deleted. Database integrity compromised.',
          details: 'Survey ID ' + surveyId + ' still exists after delete attempt'
        });
      }
      
      // Re-verify after force delete
      const { data: reverifyData } = await supabaseAdmin
        .from('surveys')
        .select('id')
        .eq('id', surveyId)
        .maybeSingle();
        
      if (reverifyData) {
        console.error('P0 SYSTEM FAILURE: Survey persists even after force delete');
        return res.status(500).json({ 
          error: 'CRITICAL SYSTEM FAILURE: Survey deletion impossible. Manual database intervention required.'
        });
      }
    }

    console.log('CRITICAL SUCCESS: Survey confirmed deleted from database');
    return res.json({ success: true, deleted: 1 });
  } catch (error) {
    console.error('Admin survey delete failed:', error);
    return res.status(500).json({ error: 'Unable to delete survey: ' + error.message });
  }
});

app.delete('/api/admin/surveys/:surveyId/responses/:responseId', requireAdmin, async (req, res) => {
  const { surveyId, responseId } = req.params;

  try {
    const { error } = await supabaseAdmin
      .from('responses')
      .delete()
      .eq('id', responseId)
      .eq('survey_id', surveyId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Admin response delete failed:', error);
    return res.status(500).json({ error: 'Unable to delete response.' });
  }
});

app.post('/api/admin/surveys/:surveyId/status', requireAdmin, async (req, res) => {
  const surveyId = req.params.surveyId;
  const { status } = req.body || {};

  if (status !== 'open' && status !== 'closed') {
    return res.status(400).json({ error: 'Invalid status value.' });
  }

  try {
    const { error } = await supabaseAdmin
      .from('surveys')
      .update({ status })
      .eq('id', surveyId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Admin survey status update failed:', error);
    return res.status(500).json({ error: 'Unable to update survey status.' });
  }
});

app.get('/api/admin/surveys/:surveyId/analytics', requireAdmin, async (req, res) => {
  const surveyId = req.params.surveyId;
  console.log('Analytics request for survey:', surveyId);

  try {
    const { data: survey, error: surveyError } = await supabaseAdmin
      .from('surveys')
      .select('*')
      .eq('id', surveyId)
      .single();

    if (surveyError || !survey) {
      console.error('Survey not found:', surveyError);
      return res.status(404).json({ error: 'Survey not found.' });
    }
    console.log('Found survey:', survey.title);

    const { data: questions, error: questionError } = await supabaseAdmin
      .from('questions')
      .select('*')
      .eq('survey_id', surveyId)
      .order('order_index', { ascending: true });

    if (questionError) {
      console.error('Questions error:', questionError);
      return res.status(500).json({ error: questionError.message });
    }
    console.log('Found questions:', questions?.length || 0);

    // First, just count responses to verify they exist
    const { count: responseCount, error: countError } = await supabaseAdmin
      .from('responses')
      .select('*', { count: 'exact', head: true })
      .eq('survey_id', surveyId);

    console.log('Response count:', responseCount, 'Count error:', countError);

    // Now fetch the actual responses
    const { data: responses, error: responsesError } = await supabaseAdmin
      .from('responses')
      .select('*')
      .eq('survey_id', surveyId)
      .order('submitted_at', { ascending: false });

    if (responsesError) {
      console.error('Responses error:', responsesError);
      return res.status(500).json({ error: responsesError.message });
    }
    console.log('Found responses:', responses?.length || 0);

    return res.json({ survey, questions: questions || [], responses: responses || [] });
  } catch (error) {
    console.error('Admin analytics load failed:', error);
    return res.status(500).json({ error: 'Unable to load analytics.' });
  }
});

// ============================================================================
// DOCUMENT UPLOAD & AI QUESTION GENERATION
// Context-Aware Document Processing with Strict Grounding
// ============================================================================

import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';

// Dynamic imports for CommonJS modules
let pdfParse;
let mammoth;

async function loadModules() {
  const pdfParseModule = await import('pdf-parse');
  const mammothModule = await import('mammoth');
  pdfParse = pdfParseModule.default || pdfParseModule;
  mammoth = mammothModule.default || mammothModule;
}

// Load modules on startup
loadModules().catch(err => console.error('Failed to load parsing modules:', err));

// Initialize Gemini (FREE TIER)
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || '');

// File size limit: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Text chunking configuration
const CHUNK_SIZE = 4000; // Characters per chunk
const CHUNK_OVERLAP = 500; // Overlap between chunks for context preservation

// Question schema for validation
const GeneratedQuestionSchema = z.array(z.object({
  type: z.enum(['choice', 'text', 'likert']),
  question_text: z.string().min(5).max(500),
  options: z.array(z.string()).nullable(),
  required: z.boolean().default(true),
  sourceContext: z.string().optional(),
}));

/**
 * Chunk text into smaller pieces for processing
 * Uses sliding window approach with overlap for context preservation
 */
function chunkText(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const chunks = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    // Try to end at a sentence boundary
    let chunkEnd = end;
    if (end < text.length) {
      // Look for sentence ending punctuation within last 100 chars
      const searchStart = Math.max(end - 100, start);
      const searchText = text.slice(searchStart, end + 100);
      const sentenceEnd = searchText.search(/[.!?]\s/);
      if (sentenceEnd !== -1) {
        chunkEnd = searchStart + sentenceEnd + 1;
      }
    }
    
    chunks.push(text.slice(start, chunkEnd).trim());
    start = chunkEnd - overlap;
    if (start >= chunkEnd) start = chunkEnd; // Prevent infinite loop
  }
  
  return chunks;
}

/**
 * Extract text from uploaded file based on file type
 */
async function extractTextFromFile(fileBuffer, fileName) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  
  // Ensure modules are loaded
  if (!pdfParse || !mammoth) {
    await loadModules();
  }
  
  try {
    if (ext === 'pdf') {
      const pdfData = await pdfParse(fileBuffer);
      return {
        text: pdfData.text,
        pageCount: pdfData.numpages,
        info: pdfData.info
      };
    } else if (ext === 'docx') {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      return {
        text: result.value,
        pageCount: null,
        info: { title: result.messages?.[0] || 'DOCX Document' }
      };
    } else if (ext === 'txt') {
      return {
        text: fileBuffer.toString('utf-8'),
        pageCount: null,
        info: { title: fileName }
      };
    } else {
      throw new Error('Unsupported file type. Only PDF, DOCX, and TXT are supported.');
    }
  } catch (error) {
    console.error('Text extraction error:', error);
    throw new Error(`Failed to extract text: ${error.message}`);
  }
}

/**
 * Generate system prompt for AI with strict grounding constraints
 */
function generateSystemPrompt(config) {
  const { questionTypes, complexity, strictGrounding } = config;
  
  const enabledTypes = [];
  if (questionTypes.multipleChoice) enabledTypes.push('multiple choice');
  if (questionTypes.boolean) enabledTypes.push('boolean (Yes/No)');
  if (questionTypes.shortAnswer) enabledTypes.push('short answer');
  if (questionTypes.likert) enabledTypes.push('Likert scale (1-5)');
  
  const complexityGuidelines = {
    academic: 'Create questions that test academic understanding, requiring analysis of concepts, theories, and methodologies presented in the text.',
    research: 'Generate research-grade questions suitable for scholarly evaluation. Questions should probe deeper understanding, require critical analysis, and assess comprehension of research findings, methodologies, and implications.',
    analytical: 'Create evaluative questions that require synthesis of information, critical thinking, and application of concepts from the document.'
  };
  
  return `You are an expert educational assessment designer specializing in creating research-grade questionnaires.

## ABSOLUTE GROUNDING CONSTRAINT (CRITICAL)
${strictGrounding ? `
⚠️ STRICT GROUNDING ENFORCED ⚠️
- Generate questions SOLELY based on the provided document text
- ZERO external knowledge or assumptions allowed
- If the document lacks sufficient information for a question, STOP and return fewer questions
- NEVER hallucinate facts, statistics, or claims not explicitly in the text
- Each question must be verifiable by referencing specific content in the document
` : `
Generate questions primarily based on the document, but you may use general knowledge to frame questions appropriately.
`}

## QUESTION TYPE REQUIREMENTS
Generate ONLY these question types: ${enabledTypes.join(', ')}

For each type:
- Multiple Choice: 3-5 distinct options, one correct answer clearly supported by text
- Boolean: Yes/No or True/False format, based on explicit claims in document
- Short Answer: Questions requiring 1-3 sentence responses, testing comprehension
- Likert Scale: Statements to rate on 1-5 scale (Strongly Disagree to Strongly Agree), based on evaluable claims

## COMPLEXITY LEVEL: ${complexity.toUpperCase()}
${complexityGuidelines[complexity]}

## QUALITY CRITERIA
1. Questions must be clear, unambiguous, and grammatically correct
2. Avoid questions that can be answered without reading the document
3. Include a mix of factual recall and analytical thinking
4. Ensure questions cover different sections/aspects of the document
5. For Likert scales, use statements that can be evaluated (not questions)

## OUTPUT FORMAT
Return a JSON array of question objects with this exact structure:
[
  {
    "type": "choice" | "text" | "likert",
    "question_text": "string (the question or statement)",
    "options": ["option1", "option2", ...] or null for text/likert,
    "required": true,
    "sourceContext": "Brief excerpt from document this is based on"
  }
]

## HALLUCINATION PREVENTION
Before finalizing each question:
1. Verify the answer/expertise required is explicitly in the document
2. If insufficient content exists, generate fewer questions rather than fabricating
3. Mark the source context for traceability`;
}

// Multer-like file handling using express.raw()
app.post('/api/upload-document', express.raw({ 
  type: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'multipart/form-data'],
  limit: MAX_FILE_SIZE 
}), async (req, res) => {
  try {
    console.log('Upload request received');
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Body length:', req.body?.length);
    
    // Parse multipart form data manually
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('multipart/form-data')) {
      return res.status(400).json({ error: 'Expected multipart/form-data' });
    }

    // Simple multipart parser
    const boundaryMatch = contentType.match(/boundary=([^;\s]+)/);
    if (!boundaryMatch) {
      return res.status(400).json({ error: 'Missing boundary in content-type' });
    }
    
    let boundary = boundaryMatch[1];
    // Remove quotes if present
    boundary = boundary.replace(/^"|"$/g, '');
    
    console.log('Boundary:', boundary);

    const body = req.body;
    const bodyString = body.toString('binary');
    const parts = bodyString.split(`--${boundary}`);
    
    console.log('Number of parts:', parts.length);
    
    let fileBuffer = null;
    let fileName = '';
    let fileType = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      console.log(`Part ${i} length:`, part.length);
      
      if (part.includes('Content-Disposition') && part.includes('filename=')) {
        const filenameMatch = part.match(/filename="([^"]+)"/);
        if (filenameMatch) {
          fileName = filenameMatch[1];
          console.log('Found file:', fileName);
          
          const contentTypeMatch = part.match(/Content-Type:\s*([^\r\n]+)/i);
          fileType = contentTypeMatch ? contentTypeMatch[1].trim() : 'application/octet-stream';
          console.log('File type:', fileType);
          
          // Extract file content (after double CRLF)
          const contentStart = part.indexOf('\r\n\r\n');
          if (contentStart !== -1) {
            let content = part.slice(contentStart + 4);
            // Remove trailing CRLF and boundary markers
            content = content.replace(/\r\n--$/, '');
            content = content.replace(/\r\n$/, '');
            fileBuffer = Buffer.from(content, 'binary');
            console.log('Extracted buffer size:', fileBuffer.length);
          } else {
            console.log('No content start found in part');
          }
        }
      }
    }

    if (!fileBuffer) {
      console.error('No file buffer extracted from upload');
      return res.status(400).json({ error: 'No file found in upload. Please ensure you selected a valid PDF, DOCX, or TXT file.' });
    }

    console.log(`Processing upload: ${fileName} (${fileBuffer.length} bytes)`);

    // Extract text from file
    const extraction = await extractTextFromFile(fileBuffer, fileName);
    
    if (!extraction.text || extraction.text.trim().length === 0) {
      return res.status(400).json({ error: 'Could not extract text from document. File may be empty, corrupted, or password-protected.' });
    }

    // Chunk the text if it's large
    const chunks = chunkText(extraction.text);
    
    console.log(`Extracted ${extraction.text.length} chars, chunked into ${chunks.length} segments`);

    return res.json({
      success: true,
      text: extraction.text,
      chunks: chunks,
      meta: {
        fileName,
        fileType,
        size: fileBuffer.length,
        pageCount: extraction.pageCount,
        charCount: extraction.text.length,
        chunkCount: chunks.length
      }
    });

  } catch (error) {
    console.error('Document upload error:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to process document',
      details: error.stack 
    });
  }
});

/**
 * AI Question Generation Endpoint
 * Implements strict grounding to prevent hallucination
 */
app.post('/api/generate-questions', express.json({ limit: '50mb' }), async (req, res) => {
  try {
    const { text, config, fileName } = req.body;
    
    if (!text || !Array.isArray(text) || text.length === 0) {
      return res.status(400).json({ error: 'Text chunks are required' });
    }
    
    if (!config) {
      return res.status(400).json({ error: 'Configuration is required' });
    }

    const { questionCount, questionTypes } = config;
    
    // Validate Gemini API key
    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Google Gemini API key not configured. Get free key at https://aistudio.google.com/app/apikey' });
    }

    console.log(`Generating ${questionCount} questions from ${text.length} chunks...`);

    // Combine chunks intelligently to fit within token limits
    // GPT-4 has ~8k-32k context, but we'll be conservative
    const MAX_CONTEXT_CHARS = 12000; // Approx 3000 tokens for content
    let combinedText = '';
    
    for (const chunk of text) {
      if ((combinedText + chunk).length <= MAX_CONTEXT_CHARS) {
        combinedText += '\n\n' + chunk;
      } else {
        break; // Stop adding chunks when approaching limit
      }
    }

    const prompt = `${generateSystemPrompt(config)}

DOCUMENT: "${fileName || 'Research Document'}"

CONTENT:
${combinedText}

Generate ${questionCount} questions based STRICTLY on this document content.
Remember: If the document doesn't contain enough information for ${questionCount} quality questions, generate fewer and STOP. Never invent information.

Respond with ONLY a JSON array of questions. No markdown, no code blocks, just raw JSON starting with [ and ending with ].`;

    // Call Gemini API (FREE TIER)
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash', // or 'gemini-1.5-pro' for better quality
      generationConfig: {
        temperature: 0.3, // Low creativity for strict grounding
        maxOutputTokens: 4000,
      }
    });

    const result = await model.generateContent(prompt);
    const aiResponse = result.response.text();
    
    if (!aiResponse) {
      return res.status(500).json({ error: 'AI returned empty response' });
    }

    // Parse and validate the response
    let parsedQuestions;
    try {
      const parsed = JSON.parse(aiResponse);
      // AI might wrap questions in a 'questions' key or return array directly
      parsedQuestions = Array.isArray(parsed) ? parsed : parsed.questions || [];
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return res.status(500).json({ 
        error: 'AI returned invalid JSON',
        rawResponse: aiResponse.substring(0, 500)
      });
    }

    // Validate with Zod schema
    const validation = GeneratedQuestionSchema.safeParse(parsedQuestions);
    
    if (!validation.success) {
      console.error('Validation error:', validation.error);
      return res.status(500).json({ 
        error: 'Generated questions failed validation',
        details: validation.error.issues
      });
    }

    const validQuestions = validation.data;

    // Post-process: filter out questions that might be hallucinated
    const groundedQuestions = validQuestions.filter(q => {
      // Check if sourceContext is provided and exists in document
      if (q.sourceContext && q.sourceContext.length > 10) {
        const contextLower = q.sourceContext.toLowerCase();
        const docLower = combinedText.toLowerCase();
        
        // Fuzzy match - context should appear in document
        // We'll be lenient here as AI might paraphrase slightly
        const keyPhrases = contextLower.split(' ').filter(w => w.length > 4);
        const matchCount = keyPhrases.filter(phrase => 
          docLower.includes(phrase)
        ).length;
        
        const matchRatio = matchCount / keyPhrases.length;
        return matchRatio > 0.3; // At least 30% of key phrases should match
      }
      return true; // Keep if no source context (conservative)
    });

    console.log(`Generated ${validQuestions.length} questions, ${groundedQuestions.length} passed grounding check`);

    return res.json({
      success: true,
      questions: groundedQuestions,
      meta: {
        requested: questionCount,
        generated: groundedQuestions.length,
        model: 'gemini-1.5-flash'
      }
    });

  } catch (error) {
    console.error('Question generation error:', error);
    
    // Handle specific Gemini errors
    if (error.message?.includes('quota')) {
      return res.status(429).json({ error: 'Gemini API quota exceeded (1,500 requests/day limit). Please try again tomorrow.' });
    }
    if (error.message?.includes('rate limit')) {
      return res.status(429).json({ error: 'Too many requests (60/minute limit). Please wait a moment.' });
    }
    if (error.message?.includes('token')) {
      return res.status(400).json({ error: 'Document is too long. Try a shorter document or fewer chunks.' });
    }
    
    return res.status(500).json({ 
      error: error.message || 'Failed to generate questions'
    });
  }
});

// Check if dist exists
const distPath = path.join(__dirname, 'dist');
const indexPath = path.join(distPath, 'index.html');

console.log('Checking dist folder:', distPath);
console.log('Dist exists:', fs.existsSync(distPath));
console.log('Index.html exists:', fs.existsSync(indexPath));

app.use(express.static(distPath));

app.get('*', (req, res) => {
  if (!fs.existsSync(indexPath)) {
    return res.status(500).send('Error: Frontend not built. Run npm run build first.');
  }
  res.sendFile(indexPath);
});

// ============================================================================
// SURVEY SCHEDULING ENGINE
// Automatically opens/closes surveys based on open_date and close_date
// ============================================================================

const SCHEDULER_INTERVAL_MS = 60 * 1000; // Run every minute
let schedulerRuns = 0;
let lastSchedulerError = null;

async function runSurveyScheduler() {
  try {
    // Auto-open surveys that have reached their open_date
    const { data: openedData, error: openError } = await supabaseAdmin
      .from('surveys')
      .update({ status: 'open' })
      .eq('status', 'closed')
      .not('open_date', 'is', null)
      .lte('open_date', new Date().toISOString())
      .select('id, title');

    if (openError) {
      console.error('Scheduler: Error opening surveys:', openError);
    } else if (openedData && openedData.length > 0) {
      console.log(`Scheduler: Auto-opened ${openedData.length} survey(s):`, openedData.map(s => s.title).join(', '));
    }

    // Auto-close surveys that have reached their close_date
    const { data: closedData, error: closeError } = await supabaseAdmin
      .from('surveys')
      .update({ status: 'closed' })
      .eq('status', 'open')
      .not('close_date', 'is', null)
      .lte('close_date', new Date().toISOString())
      .select('id, title');

    if (closeError) {
      console.error('Scheduler: Error closing surveys:', closeError);
    } else if (closedData && closedData.length > 0) {
      console.log(`Scheduler: Auto-closed ${closedData.length} survey(s):`, closedData.map(s => s.title).join(', '));
    }

    schedulerRuns++;
    if ((openedData?.length > 0 || closedData?.length > 0) || schedulerRuns % 10 === 0) {
      console.log(`Scheduler: Run #${schedulerRuns} completed at ${new Date().toISOString()}`);
    }
  } catch (error) {
    lastSchedulerError = error;
    console.error('Scheduler: Unexpected error:', error);
  }
}

// Start the scheduler
function startScheduler() {
  console.log('Starting survey scheduling engine...');
  console.log(`Scheduler will run every ${SCHEDULER_INTERVAL_MS / 1000} seconds`);
  
  // Run immediately on startup
  runSurveyScheduler();
  
  // Then schedule periodic runs
  setInterval(runSurveyScheduler, SCHEDULER_INTERVAL_MS);
}

// Health check endpoint that includes scheduler status
app.get('/api/health', (_req, res) => {
  return res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    scheduler: {
      active: true,
      runs: schedulerRuns,
      intervalSeconds: SCHEDULER_INTERVAL_MS / 1000,
      lastError: lastSchedulerError ? lastSchedulerError.message : null
    }
  });
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Serving files from: ${distPath}`);
  
  // Start the scheduling engine
  startScheduler();
});
