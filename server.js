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
    autoRefreshToken: false
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

app.post('/api/login', (req, res) => {
  const { passkey } = req.body || {};

  if (!passkey) {
    return res.status(400).json({ error: 'Passkey is required.' });
  }

  if (passkey !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid passkey.' });
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
    const { data, error } = await supabaseAdmin
      .from('surveys')
      .select('*')
      .eq('admin_id', req.adminUser.id)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
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
      .eq('admin_id', req.adminUser.id)
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
        total_responses: 0
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
      order_index: q.order_index
    }));

    const { error: questionError } = await supabaseAdmin
      .from('questions')
      .insert(questionRows);

    if (questionError) {
      await supabaseAdmin.from('surveys').delete().eq('id', survey.id);
      return res.status(500).json({ error: questionError.message });
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
      .update({ title, description })
      .eq('id', surveyId)
      .eq('admin_id', req.adminUser.id)
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
            order_index: q.order_index
          });
        } else {
          questionsToUpdate.push({
            id: existing.id,
            question_text: q.question_text,
            type: q.type,
            options: q.type === 'text' ? null : q.options,
            required: q.required,
            order_index: q.order_index,
            is_active: true
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
          order_index: q.order_index
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

  try {
    const { error } = await supabaseAdmin
      .from('surveys')
      .delete()
      .eq('id', surveyId)
      .eq('admin_id', req.adminUser.id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Admin survey delete failed:', error);
    return res.status(500).json({ error: 'Unable to delete survey.' });
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
      .eq('id', surveyId)
      .eq('admin_id', req.adminUser.id);

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

  try {
    const { data: survey, error: surveyError } = await supabaseAdmin
      .from('surveys')
      .select('*')
      .eq('id', surveyId)
      .eq('admin_id', req.adminUser.id)
      .single();

    if (surveyError || !survey) {
      return res.status(404).json({ error: 'Survey not found.' });
    }

    const { data: questions, error: questionError } = await supabaseAdmin
      .from('questions')
      .select('*')
      .eq('survey_id', surveyId)
      .order('order_index', { ascending: true });

    if (questionError) {
      return res.status(500).json({ error: questionError.message });
    }

    const { data: responses, error: responsesError } = await supabaseAdmin
      .from('responses')
      .select('*, question:questions(*)')
      .eq('survey_id', surveyId)
      .order('submitted_at', { ascending: false });

    if (responsesError) {
      return res.status(500).json({ error: responsesError.message });
    }

    return res.json({ survey, questions: questions || [], responses: responses || [] });
  } catch (error) {
    console.error('Admin analytics load failed:', error);
    return res.status(500).json({ error: 'Unable to load analytics.' });
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Serving files from: ${distPath}`);
});
