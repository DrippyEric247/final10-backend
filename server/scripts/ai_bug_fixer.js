const { Octokit } = require('@octokit/rest');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Initialize GitHub client
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

const [owner, repo] = process.env.GITHUB_REPO.split('/');
const issueNumber = parseInt(process.env.ISSUE_NUMBER);

console.log(`🤖 AI Bug Fixer starting for issue #${issueNumber} in ${owner}/${repo}`);

async function aiBugFixer() {
  try {
    // 1) Get issue data
    console.log('📋 Fetching issue data...');
    const { data: issue } = await octokit.issues.get({
      owner,
      repo,
      issue_number: issueNumber
    });

    console.log(`📝 Issue: ${issue.title}`);
    console.log(`🏷️  Labels: ${issue.labels.map(l => l.name).join(', ')}`);

    const metadata = parseIssueMetadata(issue);
    console.log(`🎯 Priority: ${metadata.priorityLabel}`);
    console.log(`📱 App: ${metadata.appLabel}`);
    console.log(`🧩 Subsystems: ${metadata.subsystems.join(', ')}`);

    // Check if issue has AI triage label
    const hasAiTriage = issue.labels.some(label => label.name === 'triage:ai');
    if (!hasAiTriage) {
      console.log('❌ Issue not marked for AI triage, skipping...');
      return;
    }

    // 2) Create branch for fix
    const branchName = `ai/fix-${issueNumber}`;
    console.log(`🌿 Creating branch: ${branchName}`);
    
    try {
      execSync(`git checkout -b ${branchName}`, { stdio: 'inherit' });
    } catch (error) {
      // Branch might already exist, try to checkout
      try {
        execSync(`git checkout ${branchName}`, { stdio: 'inherit' });
      } catch (checkoutError) {
        console.log('Branch exists, switching to it...');
        execSync(`git checkout ${branchName}`, { stdio: 'inherit' });
      }
    }

    // 3) Analyze repository structure
    console.log('🔍 Analyzing repository structure...');
    const repoFiles = execSync('find . -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" -o -name "*.json" | grep -E "\\.(js|jsx|ts|tsx|json)$" | head -50', { encoding: 'utf8' });
    const fileList = repoFiles.split('\n').filter(f => f.trim()).slice(0, 30); // Limit to 30 files

    // 4) Get relevant file contents for analysis
    const relevantFiles = [
      ...new Set([
        ...(metadata.filesLikelyInvolved || []).filter((f) => f && !f.endsWith('/')),
        ...fileList.filter(f =>
          f.includes('src') ||
          f.includes('components') ||
          f.includes('pages') ||
          f.includes('routes') ||
          f.includes('models') ||
          f.includes('services')
        ),
      ]),
    ].slice(0, 12);

    const fileContents = {};
    for (const file of relevantFiles) {
      try {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf8');
          // Truncate large files
          fileContents[file] = content.length > 5000 ? content.substring(0, 5000) + '...' : content;
        }
      } catch (error) {
        console.log(`⚠️  Could not read file ${file}: ${error.message}`);
      }
    }

    // 5) Create AI prompt for bug analysis and fix
    const aiPrompt = createAIPrompt(issue, fileContents, metadata);

    // 6) Call AI service (OpenAI, Claude, or your preferred LLM)
    console.log('🧠 Analyzing bug with AI...');
    const aiResponse = await callAI(aiPrompt);

    if (!aiResponse || !aiResponse.filesToModify || aiResponse.filesToModify.length === 0) {
      console.log('❌ AI could not determine a fix for this issue');
      await octokit.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body: `🤖 **AI Analysis Complete**

The AI development team analyzed this issue but could not determine an automated fix. This may require human intervention.

**Analysis:** ${aiResponse?.analysis || 'Unable to analyze the issue automatically.'}

**Next Steps:** Please review this issue manually or provide more detailed reproduction steps.`
      });
      return;
    }

    // 7) Apply AI-suggested fixes
    console.log('🔧 Applying AI fixes...');
    let fixesApplied = 0;
    let errors = [];

    for (const fileFix of aiResponse.filesToModify) {
      try {
        const filePath = fileFix.filePath;
        const newContent = fileFix.newContent;
        
        if (fs.existsSync(filePath)) {
          // Backup original file
          fs.writeFileSync(`${filePath}.backup`, fs.readFileSync(filePath, 'utf8'));
          
          // Apply fix
          fs.writeFileSync(filePath, newContent);
          fixesApplied++;
          console.log(`✅ Applied fix to ${filePath}`);
        }
      } catch (error) {
        errors.push(`Failed to fix ${fileFix.filePath}: ${error.message}`);
        console.log(`❌ Error applying fix to ${fileFix.filePath}: ${error.message}`);
      }
    }

    // 8) Run tests
    console.log('🧪 Running tests...');
    let testsPassed = false;
    try {
      execSync('npm test --silent', { stdio: 'inherit', timeout: 60000 });
      testsPassed = true;
      console.log('✅ Tests passed');
    } catch (testError) {
      console.log('❌ Tests failed:', testError.message);
    }

    // 9) Create commit and push
    if (fixesApplied > 0) {
      try {
        execSync(`git add -A && git commit -m "🤖 AI: Fix #${issueNumber}

${aiResponse.analysis || 'Automated bug fix'}

Files modified: ${aiResponse.filesToModify.map(f => f.filePath).join(', ')}
Tests: ${testsPassed ? '✅ Passed' : '❌ Failed'}"`, { stdio: 'inherit' });
        
        execSync(`git push origin ${branchName}`, { stdio: 'inherit' });
        console.log('📤 Pushed changes to GitHub');
      } catch (gitError) {
        console.log('❌ Git error:', gitError.message);
      }
    }

    // 10) Create Pull Request
    console.log('📝 Creating Pull Request...');
    try {
      const { data: pr } = await octokit.pulls.create({
        owner,
        repo,
        title: `🤖 AI Fix: ${issue.title}`,
        head: branchName,
        base: 'main',
        body: `## 🤖 Automated Bug Fix

This PR contains an automated fix for issue #${issueNumber}.

### 📋 Issue Summary
${issue.title}

### 🔧 AI Analysis
${aiResponse.analysis || 'Automated analysis and fix applied.'}

### 📁 Files Modified
${aiResponse.filesToModify.map(f => `- \`${f.filePath}\``).join('\n')}

### ✅ Testing
- Tests: ${testsPassed ? '✅ Passed' : '❌ Failed'}
- Fixes Applied: ${fixesApplied}

### 🤖 AI Development Team
This fix was automatically generated by the AI development system. Please review before merging.

---
**Related Issue:** #${issueNumber}`
      });

      console.log(`✅ Created PR #${pr.number}`);

      // 11) Update issue with PR link
      await octokit.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body: `🤖 **AI Fix Complete!**

I've analyzed and fixed this issue automatically:

**✅ Pull Request Created:** #${pr.number}
**🔧 Files Modified:** ${fixesApplied}
**🧪 Tests:** ${testsPassed ? 'Passed' : 'Failed'}

**Analysis:** ${aiResponse.analysis || 'Automated fix applied based on issue description.'}

The fix will be automatically merged once approved. This issue will be closed when the PR is merged.`
      });

      // Add labels to PR
      await octokit.issues.addLabels({
        owner,
        repo,
        issue_number: pr.number,
        labels: ['ai-generated', 'bug-fix', `fixes-${issueNumber}`]
      });

    } catch (prError) {
      console.log('❌ Error creating PR:', prError.message);
    }

  } catch (error) {
    console.error('❌ AI Bug Fixer Error:', error);
    
    // Report error to issue
    try {
      await octokit.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body: `🤖 **AI Bug Fixer Error**

The automated bug fixer encountered an error:

\`\`\`
${error.message}
\`\`\`

This issue requires human intervention. Please review manually.`
      });
    } catch (commentError) {
      console.log('Could not comment on issue:', commentError.message);
    }
  }
}

function parseIssueMetadata(issue) {
  const body = String(issue.body || '');
  const labels = (issue.labels || []).map((l) => l.name);

  const section = (name) => {
    const re = new RegExp(`## [^\\n]*${name}[^\\n]*\\n([\\s\\S]*?)(?=\\n## |$)`, 'i');
    const match = body.match(re);
    return match ? match[1].trim() : '';
  };

  const priorityLabel =
    body.match(/\*\*Priority:\*\*\s*(.+)/i)?.[1]?.trim() ||
    labels.find((l) => l.startsWith('priority:p')) ||
    'unknown';

  const appLabel =
    body.match(/\*\*Affected App:\*\*\s*([^(]+)/i)?.[1]?.trim() ||
    labels.find((l) => l.startsWith('app:')) ||
    'final10';

  const subsystems = body.match(/\*\*Subsystems:\*\*\s*(.+)/i)?.[1]
    ? body
        .match(/\*\*Subsystems:\*\*\s*(.+)/i)[1]
        .split(/[`,\s]+/)
        .map((s) => s.replace(/`/g, '').trim())
        .filter(Boolean)
    : labels.filter((l) => !l.startsWith('priority:') && !l.startsWith('app:') && l !== 'bug' && l !== 'triage:ai');

  return {
    priorityLabel,
    appLabel,
    subsystems,
    summary: section('Summary'),
    steps: section('Steps to Reproduce'),
    expected: section('Expected Result'),
    actual: section('Actual Result'),
    rootCauseHypothesis: section('Root Cause Hypothesis'),
    suggestedFix: section('Suggested Fix'),
    filesLikelyInvolved: section('Files Likely Involved')
      .split('\n')
      .map((l) => l.replace(/^- /, '').replace(/`/g, '').trim())
      .filter(Boolean),
    regressionTests: section('Regression Tests Required')
      .split('\n')
      .map((l) => l.replace(/^- \[[ x]\]\s*/i, '').trim())
      .filter(Boolean),
  };
}

function createAIPrompt(issue, fileContents, metadata) {
  const fileList = Object.keys(fileContents).join('\n');
  const fileSnippets = Object.entries(fileContents)
    .map(([file, content]) => `\n=== ${file} ===\n${content}`)
    .join('\n');

  return `
You are an AI developer tasked with fixing a bug in the Savvy Universe platform.

AUTO-CLASSIFICATION (use this — do not re-triage):
- Priority: ${metadata.priorityLabel}
- Affected App: ${metadata.appLabel}
- Subsystems: ${metadata.subsystems.join(', ')}

STRUCTURED BUG REPORT:
Summary: ${metadata.summary || issue.title}
Steps to Reproduce:
${metadata.steps || '_see issue body_'}

Expected Result:
${metadata.expected || '_not provided_'}

Actual Result:
${metadata.actual || '_not provided_'}

Root Cause Hypothesis:
${metadata.rootCauseHypothesis || '_not provided_'}

Suggested Fix:
${metadata.suggestedFix || '_not provided_'}

Files Likely Involved:
${metadata.filesLikelyInvolved.length ? metadata.filesLikelyInvolved.map((f) => `- ${f}`).join('\n') : '_infer from repo_'}

Regression Tests Required:
${metadata.regressionTests.length ? metadata.regressionTests.map((t) => `- ${t}`).join('\n') : '_add smoke tests_'}

RAW ISSUE:
Title: ${issue.title}
Description: ${issue.body}

REPOSITORY STRUCTURE:
${fileList}

RELEVANT FILE CONTENTS:
${fileSnippets}

TASK:
1. Use the root cause hypothesis and file hints as your starting point
2. Verify the hypothesis against the codebase snippets
3. Apply a minimal, focused fix in the files likely involved
4. Ensure regression tests listed above would pass

RESPONSE FORMAT (JSON):
{
  "analysis": "Brief analysis confirming or refining the hypothesis",
  "filesToModify": [
    {
      "filePath": "path/to/file.js",
      "newContent": "complete file content with fix applied",
      "explanation": "what was changed and why"
    }
  ],
  "testSteps": ["steps to verify the fix works"]
}

RULES:
- Only modify files that are directly related to the bug
- Keep changes minimal and focused
- Maintain existing code style and patterns
- Include error handling where appropriate
- Ensure the fix doesn't break existing functionality
- Address all regression tests in your verification steps
`;
}

async function callAI(prompt) {
  // This is a placeholder for your AI service integration
  // Replace with actual OpenAI, Claude, or other LLM API call
  
  if (!process.env.OPENAI_API_KEY) {
    console.log('⚠️  No OpenAI API key found, using mock response');
    return {
      analysis: "Mock AI analysis - this is a placeholder response. Configure OPENAI_API_KEY for real AI fixes.",
      filesToModify: [],
      testSteps: ["This is a mock response - configure AI integration for real fixes"]
    };
  }

  try {
    // Example OpenAI integration (uncomment and modify as needed)
    /*
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert JavaScript/Node.js developer specializing in bug fixes. Always respond with valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 4000
      })
    });

    const data = await response.json();
    const aiResponse = JSON.parse(data.choices[0].message.content);
    return aiResponse;
    */
    
    // Mock response for now
    return {
      analysis: "This is a mock AI response. Configure your preferred AI service (OpenAI, Claude, etc.) in the callAI function.",
      filesToModify: [],
      testSteps: ["Configure AI integration for automated fixes"]
    };
    
  } catch (error) {
    console.error('AI API Error:', error);
    return {
      analysis: `AI service error: ${error.message}`,
      filesToModify: [],
      testSteps: ["Fix AI service configuration"]
    };
  }
}

// Run the AI bug fixer
if (require.main === module) {
  aiBugFixer().then(() => {
    console.log('🤖 AI Bug Fixer completed');
    process.exit(0);
  }).catch((error) => {
    console.error('❌ AI Bug Fixer failed:', error);
    process.exit(1);
  });
}

module.exports = { aiBugFixer, parseIssueMetadata };






