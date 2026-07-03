const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const auth = require('../middleware/auth');
const User = require('../models/User');
const { isBetaTester, logBetaUsage, BETA_FEEDBACK_SAVVY_BONUS } = require('../services/betaTesterService');
const { grantSavvyReward } = require('../services/savvyRewardService');
const { classifyBugReport, formatIssueBody } = require('../services/bugReportClassifier');

function isQualityFeedback({ title, steps, expected, actual }) {
  const t = String(title || '').trim();
  const s = String(steps || '').trim();
  const e = String(expected || '').trim();
  const a = String(actual || '').trim();
  return t.length >= 10 && s.length >= 40 && e.length >= 8 && a.length >= 8;
}

const PRIORITY_LABEL_COLORS = Object.freeze({
  P0: 'b60205',
  P1: 'd93f0b',
  P2: 'fbca04',
  P3: '0e8a16',
});

async function ensureGithubLabels(owner, repo, labelNames) {
  if (!process.env.GITHUB_TOKEN || !labelNames.length) return labelNames;

  const headers = {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  let existing = new Set();
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/labels?per_page=100`, {
      headers,
    });
    if (res.ok) {
      const labels = await res.json();
      existing = new Set(labels.map((l) => l.name));
    }
  } catch (err) {
    console.warn('[bugReports] could not list GitHub labels:', err?.message);
    return labelNames;
  }

  for (const name of labelNames) {
    if (existing.has(name)) continue;
    const priorityMatch = name.match(/^priority:(p[0-3])$/i);
    const appMatch = name.match(/^app:(.+)$/);
    let color = '6f42c1';
    if (priorityMatch) color = PRIORITY_LABEL_COLORS[priorityMatch[1].toUpperCase()] || color;
    if (appMatch) color = '1d76db';

    try {
      const createRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/labels`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color, description: 'Auto-created by Final10 Bug Reporter' }),
      });
      if (createRes.ok || createRes.status === 422) {
        existing.add(name);
      }
    } catch (err) {
      console.warn(`[bugReports] could not create label ${name}:`, err?.message);
    }
  }

  return labelNames.filter((n) => existing.has(n));
}

// Apply auth middleware to all routes
router.use(auth);

// Preview classification before submit (no GitHub issue)
router.post('/classify', (req, res) => {
  try {
    const { title, steps, expected, actual, severity, page, userAgent } = req.body || {};
    if (!title || !steps) {
      return res.status(400).json({ message: 'Title and steps are required for classification' });
    }

    const classification = classifyBugReport({
      title,
      steps,
      expected,
      actual,
      severity,
      page,
      userAgent,
    });

    res.json({
      success: true,
      classification: {
        priority: classification.priority,
        app: classification.app,
        subsystems: classification.subsystems,
        summary: classification.summary,
        rootCauseHypothesis: classification.rootCauseHypothesis,
        suggestedFix: classification.suggestedFix,
        filesLikelyInvolved: classification.filesLikelyInvolved,
        regressionTests: classification.regressionTests,
        githubLabels: classification.githubLabels,
      },
    });
  } catch (error) {
    console.error('Error classifying bug report:', error);
    res.status(500).json({ message: 'Failed to classify bug report' });
  }
});

// Create bug report and GitHub issue
router.post('/', async (req, res) => {
  try {
    const {
      title,
      steps,
      expected,
      actual,
      severity,
      page,
      userAgent,
      timestamp,
      userId,
      username,
    } = req.body;

    // Validate required fields
    if (!title || !steps) {
      return res.status(400).json({
        message: 'Title and steps to reproduce are required',
      });
    }

    const report = {
      title,
      steps,
      expected,
      actual,
      severity,
      page,
      userAgent,
      timestamp: timestamp || new Date().toISOString(),
      userId,
      username,
    };

    const classification = classifyBugReport(report);
    const issueBody = formatIssueBody(report, classification);

    // Create GitHub issue
    let githubIssue = null;
    if (process.env.GITHUB_TOKEN && process.env.GITHUB_REPO) {
      try {
        const [owner, repo] = process.env.GITHUB_REPO.split('/');
        const labels = await ensureGithubLabels(owner, repo, classification.githubLabels);

        const githubResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: `${classification.priority.label.split('–')[0].trim()} ${title}`,
            body: issueBody,
            labels,
            assignees: process.env.GITHUB_ASSIGNEE ? [process.env.GITHUB_ASSIGNEE] : [],
          }),
        });

        if (githubResponse.ok) {
          githubIssue = await githubResponse.json();
          console.log(`✅ Created GitHub issue #${githubIssue.number} for bug report`);
        } else {
          console.error('Failed to create GitHub issue:', await githubResponse.text());
        }
      } catch (githubError) {
        console.error('GitHub API error:', githubError);
      }
    }

    const bugReport = {
      ...report,
      classification: {
        priority: classification.priority.id,
        priorityLabel: classification.priority.label,
        app: classification.app.id,
        appLabel: classification.app.label,
        subsystems: classification.subsystems,
        summary: classification.summary,
        rootCauseHypothesis: classification.rootCauseHypothesis,
        suggestedFix: classification.suggestedFix,
        filesLikelyInvolved: classification.filesLikelyInvolved,
        regressionTests: classification.regressionTests,
        githubLabels: classification.githubLabels,
      },
      githubIssueNumber: githubIssue?.number,
      githubIssueUrl: githubIssue?.html_url,
      status: 'open',
    };

    console.log('🐛 Bug Report Received:', {
      title,
      priority: classification.priority.id,
      app: classification.app.id,
      subsystems: classification.subsystems.join(', '),
      reporter: username,
      githubIssue: githubIssue?.number,
    });

    let feedbackBonus = null;
    const reporterId = req.user?.id || userId;
    if (reporterId && isQualityFeedback({ title, steps, expected, actual })) {
      try {
        const reporter = await User.findById(reporterId);
        if (reporter && isBetaTester(reporter) && !reporter.betaFeedbackBonusGrantedAt) {
          const grant = await grantSavvyReward(reporter, {
            rewardType: 'beta_feedback',
            amount: BETA_FEEDBACK_SAVVY_BONUS,
            idempotencyKey: `beta_feedback:${reporter._id}`,
            note: 'Quality beta feedback bonus',
            meta: { page, severity, priority: classification.priority.id },
          });
          if (grant.granted) {
            reporter.betaFeedbackBonusGrantedAt = new Date();
            await reporter.save();
            void logBetaUsage(reporter._id, 'feedback_bonus', { amount: BETA_FEEDBACK_SAVVY_BONUS });
            feedbackBonus = {
              savvyAwarded: BETA_FEEDBACK_SAVVY_BONUS,
              newBalance: grant.newBalance,
            };
          }
        }
      } catch (bonusErr) {
        console.warn('[bugReports] feedback bonus skipped:', bonusErr?.message);
      }
    }

    res.json({
      success: true,
      message: feedbackBonus
        ? `Bug report submitted. +${BETA_FEEDBACK_SAVVY_BONUS} Savvy awarded for quality feedback!`
        : 'Bug report submitted successfully',
      feedbackBonus,
      classification: bugReport.classification,
      githubIssue: githubIssue
        ? {
            number: githubIssue.number,
            url: githubIssue.html_url,
          }
        : null,
      bugReport,
    });
  } catch (error) {
    console.error('Error creating bug report:', error);
    res.status(500).json({
      message: 'Failed to create bug report',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

// Get bug reports (admin only)
router.get('/', async (req, res) => {
  try {
    const user = await require('../models/User').findById(req.user.id);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    res.json({
      success: true,
      bugReports: [],
      total: 0,
    });
  } catch (error) {
    console.error('Error fetching bug reports:', error);
    res.status(500).json({ message: 'Failed to fetch bug reports' });
  }
});

// Get bug report status by GitHub issue number
router.get('/github/:issueNumber', async (req, res) => {
  try {
    const { issueNumber } = req.params;

    if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPO) {
      return res.status(503).json({ message: 'GitHub integration not configured' });
    }

    const [owner, repo] = process.env.GITHUB_REPO.split('/');
    const githubResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`, {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!githubResponse.ok) {
      return res.status(404).json({ message: 'GitHub issue not found' });
    }

    const issue = await githubResponse.json();

    res.json({
      success: true,
      issue: {
        number: issue.number,
        title: issue.title,
        state: issue.state,
        url: issue.html_url,
        labels: issue.labels?.map((label) => label.name) || [],
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        closedAt: issue.closed_at,
        pullRequests: issue.pull_requests || [],
      },
    });
  } catch (error) {
    console.error('Error fetching GitHub issue:', error);
    res.status(500).json({ message: 'Failed to fetch issue status' });
  }
});

module.exports = router;
