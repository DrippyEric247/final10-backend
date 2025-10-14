const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const auth = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(auth);

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
      username
    } = req.body;

    // Validate required fields
    if (!title || !steps) {
      return res.status(400).json({
        message: 'Title and steps to reproduce are required'
      });
    }

    // Create GitHub issue body
    const issueBody = [
      `**Severity:** ${severity?.toUpperCase() || 'MEDIUM'}`,
      `**Reported by:** ${username || 'Anonymous'} (User ID: ${userId || 'N/A'})`,
      `**Page:** \`${page || 'Unknown'}\``,
      `**Timestamp:** ${timestamp || new Date().toISOString()}`,
      `**User Agent:** \`${userAgent || 'Unknown'}\``,
      '',
      '## 🐛 Bug Description',
      title,
      '',
      '## 📋 Steps to Reproduce',
      steps || '_not provided_',
      '',
      '## ✅ Expected Behavior',
      expected || '_not provided_',
      '',
      '## ❌ Actual Behavior',
      actual || '_not provided_',
      '',
      '## 🔧 AI Development Team',
      'This issue has been automatically tagged for AI analysis and fixing.',
      '',
      '---',
      '*This bug report was automatically created from the Final10 application.*'
    ].join('\n');

    // Create GitHub issue
    let githubIssue = null;
    if (process.env.GITHUB_TOKEN && process.env.GITHUB_REPO) {
      try {
        const [owner, repo] = process.env.GITHUB_REPO.split('/');
        const githubResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: `🐛 ${title}`,
            body: issueBody,
            labels: ['bug', 'triage:ai', `severity:${severity}`],
            assignees: process.env.GITHUB_ASSIGNEE ? [process.env.GITHUB_ASSIGNEE] : []
          })
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

    // Store bug report in database (optional)
    // You could create a BugReport model if you want to track locally
    const bugReport = {
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
      githubIssueNumber: githubIssue?.number,
      githubIssueUrl: githubIssue?.html_url,
      status: 'open'
    };

    // Log the bug report
    console.log('🐛 Bug Report Received:', {
      title,
      severity,
      reporter: username,
      githubIssue: githubIssue?.number
    });

    res.json({
      success: true,
      message: 'Bug report submitted successfully',
      githubIssue: githubIssue ? {
        number: githubIssue.number,
        url: githubIssue.html_url
      } : null,
      bugReport
    });

  } catch (error) {
    console.error('Error creating bug report:', error);
    res.status(500).json({
      message: 'Failed to create bug report',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get bug reports (admin only)
router.get('/', async (req, res) => {
  try {
    // Check if user is admin
    const user = await require('../models/User').findById(req.user.id);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    // This would fetch from a BugReport model if you create one
    // For now, return empty array
    res.json({
      success: true,
      bugReports: [],
      total: 0
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
        'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
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
        labels: issue.labels?.map(label => label.name) || [],
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        closedAt: issue.closed_at,
        pullRequests: issue.pull_requests || []
      }
    });

  } catch (error) {
    console.error('Error fetching GitHub issue:', error);
    res.status(500).json({ message: 'Failed to fetch issue status' });
  }
});

module.exports = router;






