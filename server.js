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

let supabaseAdmin = null;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: Supabase credentials not set. Database features will be unavailable.');
  console.error('Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
} else {
  try {
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
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
    console.log('Supabase client initialized successfully');
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err.message);
  }
}

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
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Database not configured. Please set up environment variables.' });
  }

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
      block_type: q.block_type || 'question',
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
            block_type: q.block_type || 'question',
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
            block_type: q.block_type || 'question',
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
          block_type: q.block_type || 'question',
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
        block_type: q.block_type || 'question',
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

    // Get all unique user_ids from responses
    const allUserIds = [...new Set((responses || []).map(r => r.user_id))];
    
    // Get unique user_ids that look like UUIDs (for profile lookup)
    const uuidUserIds = allUserIds.filter(id => 
      id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    );
    
    // Fetch profiles for registered users
    let profilesMap = new Map();
    if (uuidUserIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, email')
        .in('id', uuidUserIds);
      
      (profiles || []).forEach(p => profilesMap.set(p.id, p.email));
    }

    // Fetch survey_sessions for ALL users (to get email from anonymous users)
    let sessionsMap = new Map();
    if (allUserIds.length > 0) {
      const { data: sessions, error: sessionsError } = await supabaseAdmin
        .from('survey_sessions')
        .select('user_id, email')
        .eq('survey_id', surveyId)
        .in('user_id', allUserIds);
      
      if (sessionsError) {
        console.error('Error fetching survey_sessions:', sessionsError);
      }
      
      console.log('Found survey_sessions:', sessions?.length || 0, 'for users:', allUserIds.length);
      console.log('Sessions with email:', (sessions || []).filter(s => s.email).map(s => ({ user_id: s.user_id?.slice(0, 8), email: s.email })));
      
      (sessions || []).forEach(s => {
        if (s.email) {
          sessionsMap.set(s.user_id, s.email);
        }
      });
    }

    // Enrich responses with profile email, survey session email (for anonymous), and question text
    const enrichedResponses = (responses || []).map(r => {
      const question = questions?.find(q => q.id === r.question_id);
      // Priority: 1. Profile email (registered user), 2. Survey session email (anonymous), 3. null
      const email = profilesMap.get(r.user_id) || sessionsMap.get(r.user_id) || null;
      return {
        ...r,
        profile: { email },
        question: question ? { question_text: question.question_text } : null
      };
    });

    console.log('Enriched responses sample:', enrichedResponses.slice(0, 3).map(r => ({ 
      user_id: r.user_id?.slice(0, 8), 
      email: r.profile?.email 
    })));

    return res.json({ survey, questions: questions || [], responses: enrichedResponses });
  } catch (error) {
    console.error('Admin analytics load failed:', error);
    return res.status(500).json({ error: 'Unable to load analytics.' });
  }
});

// ============================================================================
// DOCUMENT UPLOAD & AI QUESTION GENERATION
// Context-Aware Document Processing with Strict Grounding
// ============================================================================

// Rule-based question generator (no AI required)
function generateRuleBasedQuestions(fileName, questionCount) {
  const baseQuestions = [
    {
      id: 'rule-1',
      type: 'choice',
      question_text: 'What is the main purpose or objective of this document?',
      options: ['Research Analysis', 'System Design', 'Implementation Study', 'Evaluation Report'],
      required: true,
      order_index: 1
    },
    {
      id: 'rule-2',
      type: 'choice', 
      question_text: 'What methodology or approach is primarily used?',
      options: ['Quantitative Analysis', 'Qualitative Research', 'Experimental Study', 'Case Study'],
      required: true,
      order_index: 2
    },
    {
      id: 'rule-3',
      type: 'text',
      question_text: 'What are the key findings or conclusions presented?',
      options: null,
      required: true,
      order_index: 3
    },
    {
      id: 'rule-4',
      type: 'likert',
      question_text: 'The document provides sufficient evidence to support its claims.',
      options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'],
      required: true,
      order_index: 4
    },
    {
      id: 'rule-5',
      type: 'choice',
      question_text: 'What is the target audience or application area?',
      options: ['Academic Researchers', 'Industry Professionals', 'Policy Makers', 'General Public'],
      required: true,
      order_index: 5
    }
  ];
  
  return baseQuestions.slice(0, Math.min(questionCount, baseQuestions.length));
}







// ============================================================================
// EMERGENCY DEMO ENDPOINT - Bypass all processing for immediate demo
// ============================================================================
app.post('/api/emergency-demo', (_req, res) => {
  console.log('EMERGENCY DEMO ACTIVATED - Bypassing all processing');
  
  const demoQuestions = [
    {
      id: 'demo-1',
      type: 'choice',
      question_text: 'What is the primary research objective of this document?',
      options: ['System Architecture Design', 'Performance Optimization', 'User Experience Analysis', 'Data Security Implementation'],
      required: true,
      order_index: 1
    },
    {
      id: 'demo-2', 
      type: 'choice',
      question_text: 'Which methodology was used for evaluation?',
      options: ['Quantitative Analysis', 'Qualitative Study', 'Mixed Methods', 'Experimental Testing'],
      required: true,
      order_index: 2
    },
    {
      id: 'demo-3',
      type: 'text',
      question_text: 'What are the main contributions of this research?',
      options: null,
      required: true,
      order_index: 3
    },
    {
      id: 'demo-4',
      type: 'likert',
      question_text: 'The methodology presented is comprehensive and well-justified.',
      options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'],
      required: true,
      order_index: 4
    }
  ];
  
  return res.json({
    success: true,
    questions: demoQuestions,
    meta: {
      requested: 4,
      generated: 4,
      model: 'emergency-demo-mode',
      note: 'Emergency demo mode activated - bypassing AI processing'
    }
  });
});

// ============================================================================
// RULE-BASED FALLBACK - No AI required
// ============================================================================
app.post('/api/rule-based-questions', express.json(), (req, res) => {
  console.log('RULE-BASED FALLBACK ACTIVATED - No AI required');
  
  const { questionCount = 5, fileName } = req.body;
  
  const questions = generateRuleBasedQuestions(fileName || 'Document', questionCount);
  
  return res.json({
    success: true,
    questions: questions,
    meta: {
      requested: questionCount,
      generated: questions.length,
      model: 'rule-based-generator',
      note: 'Rule-based questions generated - no AI APIs used'
    }
  });
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
  if (!supabaseAdmin) {
    // Skip scheduling if no database connection
    return;
  }

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
    if (((openedData && openedData.length > 0) || (closedData && closedData.length > 0)) || schedulerRuns % 10 === 0) {
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
