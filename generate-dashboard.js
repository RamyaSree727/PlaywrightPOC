const fs = require('fs');
const path = require('path');

const RESULTS_FILE = path.join(__dirname, 'results.json');
const HISTORY_FILE = path.join(__dirname, 'dashboard-history.json');
const INDEX_HTML = path.join(__dirname, 'index.html');

// 1. Read existing history or initialize empty history
let history = [];
if (fs.existsSync(HISTORY_FILE)) {
  try {
    history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
  } catch (e) {
    history = [];
  }
}

// 2. Parse current test execution from results.json (if available)
let currentRunOrgs = {};
let totalRunDurationMs = 0;
let failedTestCases = [];
let testRunStartTime = null;

if (fs.existsSync(RESULTS_FILE)) {
  try {
    const rawData = fs.readFileSync(RESULTS_FILE, 'utf8');
    const jsonResult = JSON.parse(rawData);

    if (jsonResult.stats && jsonResult.stats.startTime) {
      testRunStartTime = new Date(jsonResult.stats.startTime);
    }

    function processSuite(suite) {
      if (suite.specs && suite.specs.length > 0) {
        suite.specs.forEach(spec => {
          // Extract Org name from spec file path (e.g. Tests/Org1/Login.spec.js -> Org1)
          const filePath = spec.file || suite.file || '';
          const match = filePath.match(/Tests[/\\]([^/\\]+)/i);
          const orgName = match ? match[1] : 'General';

          if (!currentRunOrgs[orgName]) {
            currentRunOrgs[orgName] = {
              name: orgName,
              total: 0,
              passed: 0,
              failed: 0,
              flaky: 0,
              skipped: 0,
              durationMs: 0
            };
          }

          const org = currentRunOrgs[orgName];
          org.total += 1;

          // Process test attempts
          const tests = spec.tests || [];
          tests.forEach(test => {
            const results = test.results || [];
            let duration = 0;

            results.forEach(r => {
              duration += r.duration || 0;
            });

            if (spec.ok) {
              if (results.length > 1) {
                org.flaky += 1;
              }
              org.passed += 1;
            } else {
              const lastStatus = results.length > 0 ? results[results.length - 1].status : '';
              if (lastStatus === 'skipped') {
                org.skipped += 1;
              } else {
                org.failed += 1;
                failedTestCases.push({
                  org: orgName,
                  title: spec.title,
                  file: filePath
                });
              }
            }

            org.durationMs += duration;
            totalRunDurationMs += duration;
          });
        });
      }

      if (suite.suites) {
        suite.suites.forEach(processSuite);
      }
    }

    if (jsonResult.suites) {
      jsonResult.suites.forEach(processSuite);
    }
  } catch (err) {
    console.error('Error reading/parsing results.json:', err);
  }
}

// Fallback sample data if results.json is empty or missing (for initial dashboard generation)
if (Object.keys(currentRunOrgs).length === 0) {
  currentRunOrgs = {
    'Org1': { name: 'Org1', total: 10, passed: 9, failed: 1, flaky: 1, skipped: 0, durationMs: 45000 },
    'Org2': { name: 'Org2', total: 10, passed: 10, failed: 0, flaky: 0, skipped: 0, durationMs: 38000 }
  };
  failedTestCases.push({
    org: 'Org1',
    title: 'Functional validation @p0 @smoke',
    file: 'Tests/Org1/Login.spec.js'
  });
}

// Helper function to recursively copy directory contents
function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Save org-specific Playwright HTML reports under reports/<orgName>/
const PLAYWRIGHT_REPORT_DIR = path.join(__dirname, 'playwright-report');
const REPORTS_DIR = path.join(__dirname, 'reports');

if (fs.existsSync(PLAYWRIGHT_REPORT_DIR)) {
  Object.keys(currentRunOrgs).forEach(orgName => {
    const orgReportDir = path.join(REPORTS_DIR, orgName);
    copyDirSync(PLAYWRIGHT_REPORT_DIR, orgReportDir);
    currentRunOrgs[orgName].reportPath = 'reports/' + orgName + '/index.html';
  });
}

// 3. Append current run to history using dynamic execution timestamp
const runDate = testRunStartTime || new Date();
const currentDateStr = runDate.toLocaleDateString('en-US');
const currentRun = {
  date: currentDateStr,
  timestamp: runDate.toISOString(),
  orgs: currentRunOrgs
};

// Limit history to last 10 runs or keep all
history.push(currentRun);
// Keep last 20 runs in history file
if (history.length > 20) {
  history = history.slice(-20);
}

// Normalize dates in history based on timestamp to ensure dynamic date rendering
history.forEach(item => {
  if (item.timestamp) {
    const d = new Date(item.timestamp);
    if (!isNaN(d.getTime())) {
      item.date = d.toLocaleDateString('en-US');
    }
  }
});

fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf8');

// 4. Calculate Aggregate Metrics for Dashboard
let totalTestsAll = 0;
let totalPassedAll = 0;
let totalFailedAll = 0;
let totalFlakyAll = 0;
let totalSkippedAll = 0;
let totalDurationMsAll = 0;

const summaryRows = [];
const ratingCards = [];
const orgLabels = [];
const passedData = [];
const failedData = [];
const flakyData = [];
const skipData = [];
const ratesData = [];
const observationsFailures = [];
const observationsRecs = [];
const verdictItems = [];

// Determine weeks or run count
const weekCount = Math.ceil(history.length / 5) || 1;
const totalRunCount = history.length;

history.forEach((runItem, runIdx) => {
  const weekNum = Math.floor(runIdx / 5) + 1;
  const weekLabel = `Week ${weekNum}`;
  const orgEntries = Object.values(runItem.orgs);
  const rowspan = orgEntries.length;

  orgEntries.forEach((org, orgIdx) => {
    totalTestsAll += org.total;
    totalPassedAll += org.passed;
    totalFailedAll += org.failed;
    totalFlakyAll += org.flaky;
    totalSkippedAll += org.skipped;
    totalDurationMsAll += org.durationMs;

    const passRate = org.total > 0 ? ((org.passed / org.total) * 100).toFixed(1) : 0;
    const durationMin = (org.durationMs / 60000).toFixed(1);
    const scoreVal = (passRate / 10).toFixed(1);
    const scoreClass = scoreVal >= 9.0 ? 'score-a' : scoreVal >= 7.5 ? 'score-b' : 'score-c';
    const scoreColor = scoreVal >= 9.0 ? '#5bf5bc' : scoreVal >= 7.5 ? '#ffd166' : '#ff6b6b';

    const fullLabel = `${weekLabel} (${runItem.date}) — ${org.name}`;
    orgLabels.push(fullLabel);
    passedData.push(org.passed);
    failedData.push(org.failed);
    flakyData.push(org.flaky);
    skipData.push(org.skipped);
    ratesData.push(parseFloat(passRate));

    const weekTd = orgIdx === 0
      ? `<td rowspan="${rowspan}" style="vertical-align:middle;background:#f8faff;border-right:2px solid #e8ecf4;text-align:center;">
          <div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:4px;">
            <input type="checkbox" class="cb-week" data-run-idx="${runIdx}" onclick="toggleRunCbs(this, ${runIdx})" title="Select all orgs in this run block"/>
            <strong>${weekLabel}</strong>
          </div>
          <span style="font-size:10px;color:#7a8ba8;font-weight:normal;">📅 ${runItem.date}</span>
        </td>`
      : '';

    const borderStyle = orgIdx === rowspan - 1 ? 'border-bottom:2px solid #e8ecf4;' : '';

    const reportLink = org.reportPath || (fs.existsSync(path.join(__dirname, 'reports', org.name, 'index.html'))
      ? 'reports/' + org.name + '/index.html'
      : 'playwright-report/index.html');

    // Summary Table Row
    summaryRows.push(`<tr style="${borderStyle}">
      ${weekTd}
      <td>
        <div style="display:flex;align-items:center;gap:8px;">
          <input type="checkbox" class="row-cb" data-run-idx="${runIdx}" data-org="${org.name}" data-week="${weekNum}" onclick="updateSelectCount()"/>
          <a href="${reportLink}" target="_blank" class="org-link">${org.name} ↗</a>
        </div>
      </td>
      <td class="n">${org.total}</td>
      <td class="n" style="color:#0a7c55;font-weight:700">${org.passed}</td>
      <td class="n" style="color:#b71c1c;font-weight:700">${org.failed}</td>
      <td class="n" style="color:#b05c00">${org.flaky}</td>
      <td class="n" style="color:#607d8b">${org.skipped}</td>
      <td class="n"><span class="rc-score-badge ${scoreClass}" style="font-size:11px;padding:3px 10px">${passRate}%</span></td>
      <td class="n">${runItem.date}</td>
      <td class="n">${durationMin}m</td>
    </tr>`);

    // Rating Card
    const avgSecPerTest = org.total > 0 ? (org.durationMs / org.total / 1000).toFixed(2) : 0;
    ratingCards.push(`
  <div class="rating-card">
    <div class="rc-header">
      <div>
        <div class="rc-title"><a href="${reportLink}" target="_blank" class="org-link">${org.name} (${weekLabel}) ↗</a></div>
        <div class="rc-domain">${org.total} tests &middot; ${runItem.date}</div>
      </div>
      <div class="rc-score-badge ${scoreClass}">${scoreVal}<span style="font-size:11px;font-weight:600">/10</span></div>
    </div>
    <div class="rc-divider"></div>
    <div class="rc-breakdown">
      <div class="rb-row"><span class="rb-criterion">Pass Rate (${org.passed}/${org.total})</span>
        <div class="rb-bar-wrap"><div class="rb-bar good" style="width:${passRate}%"></div></div>
        <span class="rb-pts">${passRate}%</span></div>
      <div class="rb-row"><span class="rb-criterion">Stability (flaky: ${org.flaky})</span>
        <div class="rb-bar-wrap"><div class="rb-bar good" style="width:${passRate}%"></div></div>
        <span class="rb-pts">${org.failed + org.flaky} issues</span></div>
      <div class="rb-row"><span class="rb-criterion">Failed Tests</span>
        <div class="rb-bar-wrap"><div class="rb-bar ok" style="width:${org.total > 0 ? (org.failed/org.total*100).toFixed(0) : 0}%"></div></div>
        <span class="rb-pts">${org.failed} failed</span></div>
      <div class="rb-row"><span class="rb-criterion">Avg Duration / test</span>
        <div class="rb-bar-wrap"><div class="rb-bar good" style="width:65%"></div></div>
        <span class="rb-pts">${avgSecPerTest}s</span></div>
    </div>
    <div class="rc-stats">
      <div class="rc-stat"><strong style="color:#0a7c55">${org.passed}</strong>Passed</div>
      <div class="rc-stat"><strong style="color:#b71c1c">${org.failed}</strong>Failed</div>
      <div class="rc-stat"><strong style="color:#b05c00">${org.flaky}</strong>Flaky</div>
      <div class="rc-stat"><strong>${durationMin}m</strong>Total</div>
    </div>
  </div>`);

    if (org.failed > 0 || org.flaky > 0) {
      observationsFailures.push(`<li><span>❌</span><span><strong>${weekLabel} › ${org.name}:</strong> ${org.failed} failed, ${org.flaky} flaky (${passRate}% pass rate).</span></li>`);
      observationsRecs.push(`<li><span>🔴</span><span><strong>HIGH:</strong> Investigate failure in ${weekLabel} › ${org.name}.</span></li>`);
    } else {
      observationsRecs.push(`<li><span>🟢</span><span><strong>HEALTHY:</strong> ${weekLabel} › ${org.name} suite is 100% passing.</span></li>`);
    }

    verdictItems.push(`
    <div class="fb-cs-item">
      <div class="fb-cs-label">${weekLabel} &mdash; ${org.name}</div>
      <div class="fb-cs-score" style="color:${scoreColor}">${scoreVal} / 10</div>
      <div class="fb-cs-detail">${org.passed}/${org.total} passed</div>
    </div>`);
  });
});

const overallPassRate = totalTestsAll > 0 ? ((totalPassedAll / totalTestsAll) * 100).toFixed(1) : 0;
const overallDurationMin = (totalDurationMsAll / 60000).toFixed(1);

// Weekly Grouped Data for Trend Chart
const weeklyLabels = [];
const weeklyPassRates = [];
const weeklyTotals = [];
const weeklyTableRows = [];

for (let w = 1; w <= weekCount; w++) {
  const wLabel = `Week ${w}`;

  let wTotal = 0;
  let wPassed = 0;
  let wFailed = 0;
  let wFlaky = 0;
  const wDates = [];

  history.forEach((runItem, rIdx) => {
    if (Math.floor(rIdx / 5) + 1 === w) {
      if (runItem.date && !wDates.includes(runItem.date)) {
        wDates.push(runItem.date);
      }
      Object.values(runItem.orgs).forEach(o => {
        wTotal += o.total;
        wPassed += o.passed;
        wFailed += o.failed;
        wFlaky += o.flaky;
      });
    }
  });

  const dateSubtext = wDates.length > 1 
    ? `${wDates[0]} &ndash; ${wDates[wDates.length - 1]}`
    : (wDates[0] || '');

  const fullWLabel = dateSubtext ? `${wLabel} (${dateSubtext})` : wLabel;
  weeklyLabels.push(fullWLabel);

  const wRate = wTotal > 0 ? ((wPassed / wTotal) * 100).toFixed(1) : 0;
  weeklyPassRates.push(parseFloat(wRate));
  weeklyTotals.push(wTotal);

  weeklyTableRows.push(`<tr>
      <td><strong>${wLabel}</strong>${dateSubtext ? `<br/><span style="font-size:10px;color:#7a8ba8;font-weight:normal;">📅 ${dateSubtext}</span>` : ''}</td>
      <td class="n">${wTotal}</td>
      <td class="n" style="color:#0a7c55;font-weight:700">${wPassed}</td>
      <td class="n" style="color:#b71c1c;font-weight:700">${wFailed}</td>
      <td class="n" style="color:#b05c00">${wFlaky}</td>
      <td><div class="wk-rate-wrap">
        <div class="wk-rate-bar-bg"><div class="wk-rate-bar" style="width:${wRate}%;background:${wRate>=90?'#06c98a':wRate>=75?'#f4a93a':'#e53935'}"></div></div>
        <span class="wk-rate-val" style="color:${wRate>=90?'#06c98a':wRate>=75?'#f4a93a':'#e53935'}">${wRate}%</span>
      </div></td>
    </tr>`);
}

const genDateStr = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });

// Determine dynamic dashboard header title based on triggered Orgs in latest run
const currentOrgsList = Object.keys(currentRunOrgs);
let dashboardHeading = 'Orgwise Regression Dashboard';

if (process.env.TARGET_ORG && process.env.TARGET_ORG !== 'All') {
  dashboardHeading = `${process.env.TARGET_ORG} Regression Dashboard`;
} else if (currentOrgsList.length === 1) {
  dashboardHeading = `${currentOrgsList[0]} Regression Dashboard`;
} else if (currentOrgsList.length > 1) {
  dashboardHeading = 'All Orgs Regression Dashboard';
}

// 5. Build Complete HTML Page
const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Orgwise Regression Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;font-size:11.5px;color:#1a1a2e;background:#f4f6fb;padding:28px 32px}
    .page-header{background:linear-gradient(135deg,#0d1b3e 0%,#1a3a6b 60%,#1e5fa8 100%);color:#fff;border-radius:10px;padding:32px 40px;margin-bottom:24px;position:relative;overflow:hidden}
    .page-header::before{content:'';position:absolute;right:-80px;top:-80px;width:280px;height:280px;border-radius:50%;background:rgba(255,255,255,0.04)}
    .header-top{display:flex;justify-content:space-between;align-items:flex-start}
    .header-top .title-block h1{font-size:22px;font-weight:800}
    .header-top .title-block .sub{font-size:12px;color:#93b4de;margin-top:4px}
    .run-badge{background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);border-radius:8px;padding:10px 18px;text-align:right;flex-shrink:0}
    .run-badge .rb-label{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#93b4de}
    .run-badge .rb-val{font-size:13px;font-weight:700;color:#fff;margin-top:2px}
    .overview{margin-top:24px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:18px 22px}
    .overview h3{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#93b4de;margin-bottom:10px}
    .metric-row{display:flex;gap:0;margin-top:16px;border:1px solid rgba(255,255,255,0.12);border-radius:8px;overflow:hidden}
    .metric-cell{flex:1;padding:12px 16px;text-align:center;border-right:1px solid rgba(255,255,255,0.1)}
    .metric-cell:last-child{border-right:none}
    .metric-cell .mc-label{font-size:9px;text-transform:uppercase;letter-spacing:0.8px;color:#93b4de}
    .metric-cell .mc-val{font-size:22px;font-weight:800;color:#fff;line-height:1.1;margin-top:3px}
    .metric-cell .mc-sub{font-size:9.5px;color:#93b4de;margin-top:2px}
    .mc-green .mc-val{color:#5bf5bc}.mc-yellow .mc-val{color:#ffd166}.mc-blue .mc-val{color:#82c5ff}.mc-red .mc-val{color:#ff6b6b}
    .rating-row{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:28px}
    @media(max-width:900px){.rating-row{grid-template-columns:1fr 1fr}}
    .rating-card{background:#fff;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.09);overflow:hidden;border:1px solid #e8ecf4}
    .rc-header{padding:14px 18px 10px;display:flex;justify-content:space-between;align-items:flex-start}
    .rc-header .rc-title{font-size:12px;font-weight:700;color:#1a1a2e}
    .rc-header .rc-domain{font-size:10px;color:#7a8ba8;margin-top:2px}
    .rc-score-badge{font-size:20px;font-weight:900;line-height:1;padding:6px 12px;border-radius:8px;flex-shrink:0}
    .score-a{background:#e8f8f2;color:#0a7c55}.score-b{background:#fff4e0;color:#b05c00}.score-c{background:#fdecea;color:#b71c1c}
    .rc-divider{height:1px;background:#f0f2f7;margin:0 18px}
    .rc-breakdown{padding:12px 18px 14px}
    .rb-row{display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:10.5px}
    .rb-row .rb-criterion{color:#555;min-width:140px}
    .rb-row .rb-pts{font-weight:700;color:#1a3a6b;font-size:11px;min-width:60px;text-align:right}
    .rb-bar-wrap{height:4px;background:#eef0f6;border-radius:4px;margin:0 8px;flex:1}
    .rb-bar{height:4px;border-radius:4px}
    .rb-bar.full{background:#06c98a}.rb-bar.good{background:#1e5fa8}.rb-bar.ok{background:#f4a93a}
    .rc-stats{display:flex;gap:0;border-top:1px solid #f0f2f7}
    .rc-stat{flex:1;padding:8px 0;text-align:center;border-right:1px solid #f0f2f7;font-size:10px;color:#6c7a96}
    .rc-stat:last-child{border-right:none}
    .rc-stat strong{display:block;font-size:13px;font-weight:800;color:#1a1a2e;margin-bottom:1px}
    .sec-hdr{display:flex;align-items:center;justify-content:space-between;margin:22px 0 12px;padding-bottom:8px;border-bottom:2px solid #e8ecf4;flex-wrap:wrap;gap:8px}
    .sec-hdr h2{font-size:13px;font-weight:700;color:#1a3a6b}
    .sec-hdr .sh-meta{font-size:10px;color:#7a8ba8;margin-top:2px}
    .sum-wrap{background:#fff;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.07);border:1px solid #e8ecf4;overflow:hidden;margin-bottom:28px}
    table{width:100%;border-collapse:collapse;font-size:12px}
    thead tr{background:#1a3a6b;color:#fff}
    thead th{padding:12px 18px;text-align:left;font-size:10.5px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;white-space:nowrap}
    tbody tr{border-bottom:1px solid #f0f2f7}
    tbody tr:last-child{border-bottom:none}
    tbody td{padding:12px 18px;vertical-align:middle;line-height:1.6;color:#2e3a50;white-space:nowrap}
    tfoot tr{background:#f8f9fc;font-weight:700;border-top:2px solid #e8ecf4}
    tfoot td{padding:12px 18px;white-space:nowrap}
    .n{text-align:right}
    .chart-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:0}
    .chart-grid.one{grid-template-columns:1fr}
    @media(max-width:900px){.chart-grid{grid-template-columns:1fr}}
    .chart-card{background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(30,95,168,0.10);border:1px solid #e0e8f8;padding:24px;overflow:hidden;position:relative}
    .chart-accent{height:4px;background:linear-gradient(90deg,#1e5fa8,#1a86d9);border-radius:3px;margin:-24px -24px 18px}
    .chart-card h3{font-size:12px;font-weight:700;color:#1a3a6b;margin-bottom:16px;text-transform:uppercase;letter-spacing:0.5px}
    .chart-wrap{position:relative;height:300px}
    .viz-section{background:linear-gradient(135deg,#f7f9ff 0%,#f4f6fb 100%);border-radius:14px;border:1px solid #e0e8f8;padding:28px;margin-bottom:28px;box-shadow:0 2px 16px rgba(30,95,168,0.07)}
    .viz-header{display:flex;align-items:center;gap:16px;margin-bottom:22px;padding-bottom:16px;border-bottom:2px solid #e8ecf4}
    .viz-icon{font-size:30px;line-height:1}
    .viz-header h2{font-size:15px;font-weight:800;color:#1a3a6b;margin:0 0 3px}
    .viz-header p{font-size:10.5px;color:#7a8ba8;margin:0}
    .wk-tbl{border-radius:0;box-shadow:none;margin:0;font-size:12px}
    .wk-tbl thead th{background:#1a3a6b;padding:10px 16px}
    .wk-tbl tbody td{padding:10px 16px;white-space:nowrap}
    .wk-rate-wrap{display:flex;align-items:center;gap:8px;min-width:120px}
    .wk-rate-bar-bg{flex:1;height:6px;background:#eef0f6;border-radius:3px;overflow:hidden}
    .wk-rate-bar{height:6px;border-radius:3px}
    .wk-rate-val{font-weight:700;font-size:11px;white-space:nowrap}
    .obs-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}
    .obs-card{background:#fff;border:1px solid #e8ecf4;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.05)}
    .obs-hdr{padding:9px 14px;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px}
    .obs-hdr.red{background:#fdecea;color:#b71c1c;border-bottom:1px solid #f5c6cb}
    .obs-hdr.amber{background:#fff8e1;color:#7f5000;border-bottom:1px solid #ffe082}
    .obs-body{padding:10px 14px}
    .obs-body li{font-size:10.5px;color:#3a4a60;line-height:1.6;padding:5px 0;border-bottom:1px solid #f5f6fa;list-style:none;display:flex;gap:8px}
    .obs-body li:last-child{border-bottom:none}
    .final-bar{background:linear-gradient(135deg,#0d1b3e,#1a3a6b);border-radius:10px;padding:24px 32px;display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-top:24px;color:#fff;flex-wrap:wrap}
    .fb-left h3{font-size:14px;font-weight:700;margin-bottom:4px}
    .fb-left p{font-size:11px;color:#93b4de;margin-bottom:12px}
    .fb-cs-row{display:flex;gap:10px;flex-wrap:wrap}
    .fb-cs-item{background:rgba(255,255,255,0.08);border-radius:7px;padding:8px 14px;text-align:center}
    .fb-cs-label{font-size:9px;text-transform:uppercase;letter-spacing:0.5px;color:#93b4de}
    .fb-cs-score{font-size:16px;font-weight:900;color:#fff;margin:2px 0 1px}
    .fb-cs-detail{font-size:9px;color:#93b4de}
    .score-ring{flex-shrink:0;width:88px;height:88px;border-radius:50%;background:rgba(255,255,255,0.06);border:4px solid #5bf5bc;display:flex;flex-direction:column;align-items:center;justify-content:center}
    .score-ring .sr-val{font-size:24px;font-weight:900;color:#5bf5bc;line-height:1}
    .score-ring .sr-lbl{font-size:8px;text-transform:uppercase;letter-spacing:1px;color:#93b4de;margin-top:2px}
    .org-link{color:#1e5fa8;font-weight:600;text-decoration:none}
    .org-link:hover{text-decoration:underline}
  </style>
</head>
<body style="padding-top:16px;">

<div style="background:#eef6ff;border:1px solid #cce3ff;border-radius:8px;padding:10px 18px;margin-bottom:20px;font-size:12px;color:#1e5fa8;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
  <div>💻 <strong>Local &amp; Offline Dashboard Access:</strong> Open this file directly or run <code>npm run dashboard</code> (or <code>node serve-dashboard.js</code>) to view locally with HTTP server.</div>
  <div style="font-size:10px;font-weight:bold;background:#1e5fa8;color:#fff;padding:3px 10px;border-radius:4px;">Local &amp; GitHub Pages Ready</div>
</div>

<div class="page-header">
  <div class="header-top">
    <div class="title-block">
      <h1>${dashboardHeading}</h1>
      <div class="sub">Automated Playwright regression &mdash; ${weekCount} week(s), ${totalRunCount} run(s) &mdash; Generated ${genDateStr}</div>
    </div>
    <div class="run-badge">
      <div class="rb-label">Latest Run</div><div class="rb-val">${currentDateStr}</div>
      <div class="rb-label" style="margin-top:6px">Weeks</div><div class="rb-val">${weekCount}</div>
    </div>
  </div>
  <div class="overview">
    <h3>Executive Summary</h3>
    <div class="metric-row">
      <div class="metric-cell"><div class="mc-label">Weeks</div><div class="mc-val">${weekCount}</div><div class="mc-sub">${totalRunCount} total runs</div></div>
      <div class="metric-cell"><div class="mc-label">Total Tests</div><div class="mc-val">${totalTestsAll}</div><div class="mc-sub">All runs &amp; orgs</div></div>
      <div class="metric-cell mc-green"><div class="mc-label">Passed</div><div class="mc-val">${totalPassedAll}</div><div class="mc-sub">${overallPassRate}% pass rate</div></div>
      <div class="metric-cell mc-red"><div class="mc-label">Failed</div><div class="mc-val">${totalFailedAll}</div><div class="mc-sub">${totalFlakyAll} flaky</div></div>
      <div class="metric-cell mc-yellow"><div class="mc-label">Skipped</div><div class="mc-val">${totalSkippedAll}</div><div class="mc-sub">Excluded</div></div>
      <div class="metric-cell mc-blue"><div class="mc-label">Duration</div><div class="mc-val">${overallDurationMin}m</div><div class="mc-sub">Total across all</div></div>
    </div>
  </div>
</div>

<div class="sec-hdr"><div><h2>Organization Summary</h2><div class="sh-meta">All weeks &middot; Click org name to open its Playwright report &middot; ↗ opens in new tab</div></div></div>

<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding:10px 16px;background:#fff;border-radius:8px;border:1px solid #e8ecf4;box-shadow:0 1px 4px rgba(0,0,0,0.04);">
  <div style="font-size:11.5px;color:#1a3a6b;font-weight:600;">
    Select single/multiple weeks or orgs using checkboxes to delete specific test data
  </div>
  <div style="display:flex;gap:12px;align-items:center;">
    <span style="font-size:11px;color:#7a8ba8;"><strong id="selected-count" style="color:#1a3a6b;font-size:13px;">0</strong> selected</span>
    <button id="btn-delete-selected" onclick="deleteSelectedData()" style="background:#e53935;color:#fff;border:none;padding:6px 14px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;opacity:0.5;" disabled>
      🗑️ Delete Selected
    </button>
  </div>
</div>

<div class="sum-wrap">
  <table id="org-summary-table">
    <thead><tr>
      <th style="text-align:center;"><input type="checkbox" id="select-all-cb" onclick="toggleSelectAll(this)" title="Select / Deselect All"/> Week</th>
      <th>Organization</th><th class="n">Total</th><th class="n">Passed</th><th class="n">Failed</th>
      <th class="n">Flaky</th><th class="n">Skipped</th><th class="n">Pass Rate</th><th class="n">Run Date</th><th class="n">Duration</th>
    </tr></thead>
    <tbody>
      ${summaryRows.join('\n')}
    </tbody>
    <tfoot><tr>
      <td colspan="2">TOTAL (${weekCount} weeks, ${totalRunCount} runs)</td>
      <td class="n">${totalTestsAll}</td>
      <td class="n" style="color:#0a7c55;font-weight:700">${totalPassedAll}</td>
      <td class="n" style="color:#b71c1c;font-weight:700">${totalFailedAll}</td>
      <td class="n">${totalFlakyAll}</td><td class="n">${totalSkippedAll}</td>
      <td class="n"><span class="rc-score-badge score-b" style="font-size:11px;padding:3px 10px">${overallPassRate}%</span></td>
      <td class="n">&mdash;</td><td class="n">${overallDurationMin}m</td>
    </tr></tfoot>
  </table>
</div>

<div class="sec-hdr"><div><h2>Organization Ratings</h2><div class="sh-meta">Pass rate scored 0&ndash;10 &middot; Updated automatically per run</div></div></div>
<div class="rating-row">
  ${ratingCards.join('\n')}
</div>

<div class="viz-section">
  <div class="viz-header"><span class="viz-icon">📊</span>
    <div><h2>Visual Analysis</h2><p>Charts across all runs</p></div>
  </div>
  <div class="chart-grid" style="margin-bottom:20px">
    <div class="chart-card"><div class="chart-accent"></div><h3>📦 Tests by Run (Stacked Bar)</h3><div class="chart-wrap"><canvas id="cBar"></canvas></div></div>
    <div class="chart-card"><div class="chart-accent" style="background:linear-gradient(90deg,#06c98a,#00b4d8)"></div><h3>🍩 Overall Result Distribution (Donut)</h3><div class="chart-wrap"><canvas id="cPie"></canvas></div></div>
  </div>
  <div class="chart-grid one">
    <div class="chart-card"><div class="chart-accent" style="background:linear-gradient(90deg,#f4a93a,#e53935)"></div><h3>🎯 Pass Rate per Run (Bar)</h3><div class="chart-wrap"><canvas id="cRate"></canvas></div></div>
  </div>
</div>

<div class="viz-section" style="background:linear-gradient(135deg,#f0f7ff 0%,#f4f6fb 100%)">
  <div class="viz-header"><span class="viz-icon">📅</span>
    <div><h2>Weekly Analysis</h2><p>${weekCount} week(s) of execution data</p></div>
  </div>
  <div class="chart-grid">
    <div class="chart-card" style="padding:0;overflow:hidden">
      <div style="padding:18px 20px 12px;border-bottom:1px solid #f0f2f7"><h3 style="margin-bottom:0">📋 Week-by-week Summary</h3></div>
      <table class="wk-tbl"><thead><tr>
        <th>Week</th><th class="n">Total</th><th class="n">✅ Passed</th><th class="n">❌ Failed</th><th class="n">⚡ Flaky</th><th style="min-width:140px">Pass Rate</th>
      </tr></thead>
      <tbody id="weekly-table">
        ${weeklyTableRows.join('\n')}
      </tbody></table>
    </div>
    <div class="chart-card"><div class="chart-accent" style="background:linear-gradient(90deg,#1e5fa8,#06c98a)"></div><h3>📈 Weekly Pass Rate Trend (Line)</h3><div class="chart-wrap"><canvas id="cWeekly"></canvas></div></div>
  </div>
</div>

<div class="sec-hdr" style="margin-top:24px"><div><h2>Observations &amp; Recommendations</h2></div></div>
<div class="obs-grid">
  <div class="obs-card"><div class="obs-hdr red">Failures Detected</div><ul class="obs-body">
    ${observationsFailures.length > 0 ? observationsFailures.join('\n') : '<li><span>✅</span><span>No test failures detected.</span></li>'}
  </ul></div>
  <div class="obs-card"><div class="obs-hdr amber">Recommendations</div><ul class="obs-body">
    ${observationsRecs.join('\n')}
  </ul></div>
</div>

<div class="final-bar">
  <div class="fb-left">
    <h3>Overall Verdict &mdash; ${genDateStr}</h3>
    <p>${totalTestsAll} tests &middot; ${weekCount} weeks &middot; ${overallDurationMin}m &middot; ${totalFailedAll} failures &middot; ${totalFlakyAll} flaky</p>
    <div class="fb-cs-row">
      ${verdictItems.join('\n')}
    </div>
  </div>
  <div class="score-ring"><div class="sr-val">${overallPassRate}%</div><div class="sr-lbl">Pass Rate</div></div>
</div>

<script>
function toggleSelectAll(masterCb) {
  const cbs = document.querySelectorAll('.row-cb, .cb-week');
  cbs.forEach(cb => cb.checked = masterCb.checked);
  updateSelectCount();
}

function toggleRunCbs(runCb, runIdx) {
  const rowCbs = document.querySelectorAll('.row-cb[data-run-idx="' + runIdx + '"]');
  rowCbs.forEach(cb => cb.checked = runCb.checked);
  updateSelectCount();
}

function updateSelectCount() {
  const checkedRows = document.querySelectorAll('.row-cb:checked');
  const countSpan = document.getElementById('selected-count');
  const btnDelete = document.getElementById('btn-delete-selected');
  if (countSpan) countSpan.textContent = checkedRows.length;
  if (btnDelete) {
    if (checkedRows.length > 0) {
      btnDelete.disabled = false;
      btnDelete.style.opacity = '1';
    } else {
      btnDelete.disabled = true;
      btnDelete.style.opacity = '0.5';
    }
  }
}

async function deleteSelectedData() {
  const checkedRows = document.querySelectorAll('.row-cb:checked');
  if (checkedRows.length === 0) return;

  const items = [];
  checkedRows.forEach(cb => {
    items.push({
      runIdx: parseInt(cb.dataset.runIdx, 10),
      org: cb.dataset.org
    });
  });

  if (!confirm('Are you sure you want to delete ' + items.length + ' selected item(s)?')) {
    return;
  }

  try {
    const res = await fetch('/api/delete-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemsToDelete: items })
    });
    const result = await res.json();
    if (result.success) {
      window.location.reload();
    } else {
      alert('Failed to delete data: ' + (result.message || 'Unknown error'));
    }
  } catch (err) {
    alert('To persist data deletions on disk, please run "npm run dashboard" in your terminal to start the local server. Alternatively, delete entries directly from dashboard-history.json.');
  }
}

const ORGS = ${JSON.stringify(orgLabels)};
const PASSED = ${JSON.stringify(passedData)};
const FAILED = ${JSON.stringify(failedData)};
const FLAKY = ${JSON.stringify(flakyData)};
const SKIP = ${JSON.stringify(skipData)};
const RATES = ${JSON.stringify(ratesData)};

const WK_L = ${JSON.stringify(weeklyLabels)};
const WK_R = ${JSON.stringify(weeklyPassRates)};
const WK_T = ${JSON.stringify(weeklyTotals)};

const tot = PASSED.reduce((a,b)=>a+b,0)+FAILED.reduce((a,b)=>a+b,0)+FLAKY.reduce((a,b)=>a+b,0)+SKIP.reduce((a,b)=>a+b,0);

if (typeof Chart !== 'undefined') {
  Chart.defaults.font.family="'Segoe UI',Arial,sans-serif";
  Chart.defaults.color='#4a5568';

  new Chart(document.getElementById('cBar'),{type:'bar',
    data:{labels:ORGS,datasets:[
      {label:'Passed', data:PASSED,backgroundColor:'#06c98a',borderRadius:3},
      {label:'Failed', data:FAILED,backgroundColor:'#e53935',borderRadius:3},
      {label:'Flaky',  data:FLAKY, backgroundColor:'#f4a93a',borderRadius:3},
      {label:'Skipped',data:SKIP,  backgroundColor:'#b0bec5',borderRadius:3},
    ]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{position:'top',labels:{boxWidth:11,padding:12}}},
      scales:{x:{stacked:true,ticks:{maxRotation:45}},y:{stacked:true}}},
  });

  new Chart(document.getElementById('cPie'),{type:'doughnut',
    data:{labels:['Passed','Failed','Flaky','Skipped'],
      datasets:[{data:[PASSED.reduce((a,b)=>a+b,0),FAILED.reduce((a,b)=>a+b,0),FLAKY.reduce((a,b)=>a+b,0),SKIP.reduce((a,b)=>a+b,0)],
        backgroundColor:['#06c98a','#e53935','#f4a93a','#b0bec5'],borderWidth:2,borderColor:'#fff'}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{position:'right'},
        tooltip:{callbacks:{label:c=>\` \${c.label}: \${c.raw} (\${tot?(c.raw/tot*100).toFixed(1):0}%)\`}}}},
  });

  new Chart(document.getElementById('cRate'),{type:'bar',
    data:{labels:ORGS,datasets:[{label:'Pass %',data:RATES,borderRadius:4,
      backgroundColor:RATES.map(r=>r>=90?'#06c98a':r>=75?'#f4a93a':'#e53935')}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>\` \${c.raw}%\`}}},
      scales:{x:{ticks:{maxRotation:45}},y:{min:0,max:100,ticks:{callback:v=>v+'%'}}}},
  });

  new Chart(document.getElementById('cWeekly'),{type:'line',
    data:{labels:WK_L,datasets:[
      {label:'Pass Rate %',data:WK_R,yAxisID:'y',borderColor:'#1e5fa8',backgroundColor:'rgba(30,95,168,.12)',fill:true,tension:.4,pointRadius:6,pointBackgroundColor:'#1e5fa8'},
      {label:'Total Tests',data:WK_T,yAxisID:'y1',borderColor:'#b0bec5',borderDash:[5,5],fill:false,tension:.4,pointRadius:4},
    ]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{position:'top'}},
      scales:{y:{min:0,max:100,position:'left',ticks:{callback:v=>v+'%'}},y1:{min:0,position:'right',grid:{drawOnChartArea:false}}}},
  });
} else {
  console.warn('Chart.js CDN library is not reachable offline. Tabular data remains fully active.');
  document.querySelectorAll('.chart-wrap').forEach(el => {
    el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#7a8ba8;font-size:12px;">📊 Offline mode: Tabular & metric data active above.</div>';
  });
}
</script>
</body>
</html>`;

fs.writeFileSync(INDEX_HTML, htmlContent, 'utf8');
console.log('✅ Successfully generated index.html!');

// 6. Generate email-body.html for email report
const triggeredBy = process.env.GITHUB_EVENT_NAME === 'schedule'
  ? 'Scheduled Cron'
  : (process.env.GITHUB_ACTOR || 'Manual/Local');
const branchName = process.env.GITHUB_REF_NAME || 'main';
const emailSubjectHeading = process.env.TARGET_ORG && process.env.TARGET_ORG !== 'All' 
  ? `${process.env.TARGET_ORG} Regression Execution Summary`
  : 'All Orgs Regression Execution Summary';

const emailTableRows = Object.values(currentRunOrgs).map(org => {
  const passPct = org.total > 0 ? ((org.passed / org.total) * 100).toFixed(1) : '0.0';
  const durSec = Math.round(org.durationMs / 1000);
  const durStr = durSec >= 60 ? `${Math.floor(durSec / 60)}m ${durSec % 60}s` : `${durSec}s`;
  const passBadgeStyle = parseFloat(passPct) >= 90 
    ? 'color: #0a7c55; background-color: #e8f8f2;' 
    : parseFloat(passPct) >= 75 
      ? 'color: #b05c00; background-color: #fff4e0;' 
      : 'color: #b71c1c; background-color: #fdecea;';

  return `<tr>
    <td style="padding: 10px 12px; border-bottom: 1px solid #e8ecf4; font-weight: bold; color: #1a3a6b;">${org.name}</td>
    <td style="padding: 10px 12px; border-bottom: 1px solid #e8ecf4; text-align: center; font-weight: bold;">${org.total}</td>
    <td style="padding: 10px 12px; border-bottom: 1px solid #e8ecf4; text-align: center; color: #28a745; font-weight: bold;">${org.passed}</td>
    <td style="padding: 10px 12px; border-bottom: 1px solid #e8ecf4; text-align: center; color: #dc3545; font-weight: bold;">${org.failed}</td>
    <td style="padding: 10px 12px; border-bottom: 1px solid #e8ecf4; text-align: center;"><span style="padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 11px; ${passBadgeStyle}">${passPct}%</span></td>
    <td style="padding: 10px 12px; border-bottom: 1px solid #e8ecf4; color: #555;">${triggeredBy}</td>
    <td style="padding: 10px 12px; border-bottom: 1px solid #e8ecf4; color: #555;">${currentDateStr}</td>
    <td style="padding: 10px 12px; border-bottom: 1px solid #e8ecf4; color: #555;">${branchName}</td>
    <td style="padding: 10px 12px; border-bottom: 1px solid #e8ecf4; color: #555;">${durStr}</td>
  </tr>`;
}).join('\n');

let failedCasesHtml = '';
if (failedTestCases.length > 0) {
  failedCasesHtml = `
  <div style="margin-top: 24px; padding: 16px; background-color: #fdf2f2; border: 1px solid #f8d7da; border-radius: 8px;">
    <h3 style="margin: 0 0 10px 0; color: #dc3545; font-size: 14px; font-weight: bold;">❌ Failed Test Cases (${failedTestCases.length})</h3>
    <ul style="margin: 0; padding-left: 20px; color: #dc3545; font-size: 12px; font-weight: bold;">
      ${failedTestCases.map(tc => `<li style="margin-bottom: 6px; color: #dc3545;">[${tc.org}] ${tc.title} <span style="font-weight: normal; color: #721c24;">(${tc.file})</span></li>`).join('\n')}
    </ul>
  </div>`;
} else {
  failedCasesHtml = `
  <div style="margin-top: 20px; padding: 12px; background-color: #e8f8f2; border: 1px solid #c3e6cb; border-radius: 8px; color: #0a7c55; font-size: 12px; font-weight: bold;">
    ✅ All test cases passed successfully! No failures detected.
  </div>`;
}

const emailBodyHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1a1a2e; background-color: #f4f6fb; padding: 20px; margin: 0; }
    .container { max-width: 900px; margin: 0 auto; background: #ffffff; padding: 24px; border-radius: 10px; border: 1px solid #e8ecf4; }
    .header { background: linear-gradient(135deg, #0d1b3e 0%, #1a3a6b 100%); color: #ffffff; padding: 20px 24px; border-radius: 8px; margin-bottom: 20px; }
    .header h2 { margin: 0; font-size: 20px; font-weight: bold; }
    .header p { margin: 4px 0 0; font-size: 12px; color: #93b4de; }
    .summary-table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
    .summary-table th { background-color: #1a3a6b; color: #ffffff; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    .footer { margin-top: 24px; font-size: 11px; color: #7a8ba8; border-top: 1px solid #e8ecf4; padding-top: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>${emailSubjectHeading}</h2>
      <p>Automated Playwright Regression Test Report</p>
    </div>

    <p style="font-size: 13px;">Hello Team,</p>
    <p style="font-size: 13px;">The regression test execution for <strong>Org1</strong> and <strong>Org2</strong> has completed. Below is the detailed execution breakdown:</p>

    <table class="summary-table">
      <thead>
        <tr>
          <th>Org Name</th>
          <th style="text-align: center;">Total Test Cases</th>
          <th style="text-align: center;">Passed</th>
          <th style="text-align: center;">Failed</th>
          <th style="text-align: center;">Percentage</th>
          <th>Triggered By</th>
          <th>Date Ran</th>
          <th>Branch Name</th>
          <th>Duration</th>
        </tr>
      </thead>
      <tbody>
        ${emailTableRows}
      </tbody>
    </table>

    ${failedCasesHtml}

    <p style="margin-top: 22px; font-size: 12px; color: #4a5568;">
      Attached to this email are the interactive <code>index.html</code> dashboard and the Playwright execution report (<code>playwright-test-report.html</code>).
    </p>

    <div class="footer">
      <p>Regards,<br/><strong>Automation Quality Assurance Team</strong></p>
    </div>
  </div>
</body>
</html>`;

const EMAIL_BODY_FILE = path.join(__dirname, 'email-body.html');
fs.writeFileSync(EMAIL_BODY_FILE, emailBodyHtml, 'utf8');
console.log('✅ Successfully generated email-body.html!');
