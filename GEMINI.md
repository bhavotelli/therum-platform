CRITICAL RULE: Always refer to this document for business logic, milestone architecture, and portal boundaries before writing new features.

<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Therum — MVP Alpha/Beta Specification</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300&display=swap');

  :root {
    --navy:      #1A244E;
    --blue:      #1E55CC;
    --blue2:     #3B7DE8;
    --light:     #EEF2FA;
    --mid:       #C5D0E8;
    --grey:      #64748B;
    --slate:     #374151;
    --white:     #FFFFFF;
    --teal:      #0F766E;
    --teal-lt:   #F0FDFA;
    --amber:     #B45309;
    --amber-bg:  #FEF3C7;
    --red:       #991B1B;
    --red-bg:    #FEE2E2;
    --green:     #166534;
    --green-bg:  #DCFCE7;
    --purple:    #7C3AED;
    --purple-bg: #F5F3FF;
    --ink:       #0F1623;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'IBM Plex Sans', sans-serif;
    background: #F4F6FB;
    color: var(--slate);
    font-size: 13px;
    line-height: 1.6;
  }

  /* ── COVER ── */
  .cover {
    background: var(--navy);
    padding: 64px 80px 56px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    border-bottom: 4px solid var(--blue);
    position: relative;
    overflow: hidden;
  }
  .cover::before {
    content: '';
    position: absolute;
    top: -60px; right: -60px;
    width: 500px; height: 500px;
    background: radial-gradient(circle, rgba(30,85,204,0.12) 0%, transparent 70%);
    pointer-events: none;
  }
  .cover h1 { font-size: 40px; font-weight: 700; color: white; line-height: 1.1; letter-spacing: -0.5px; }
  .cover .sub { font-size: 16px; color: #93C5FD; margin-top: 8px; font-weight: 300; }
  .cover-meta { text-align: right; font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: #64748B; letter-spacing: 1px; flex-shrink: 0; }
  .cover-meta .ver { color: #93C5FD; font-size: 12px; margin-top: 4px; }

  /* ── STATUS BAR ── */
  .status-bar {
    background: var(--ink);
    padding: 14px 80px;
    display: flex;
    gap: 40px;
    align-items: center;
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }
  .status-item { display: flex; flex-direction: column; gap: 3px; }
  .status-label { font-family: 'IBM Plex Mono', monospace; font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase; color: #475569; }
  .status-val { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: #93C5FD; font-weight: 600; }
  .status-sep { width: 1px; height: 36px; background: rgba(255,255,255,0.07); }

  /* ── SECTION DIVIDER ── */
  .section-divider {
    padding: 18px 80px;
    display: flex;
    align-items: center;
    gap: 20px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .sd-num {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 28px;
    font-weight: 700;
    line-height: 1;
    opacity: 0.15;
    color: white;
    flex-shrink: 0;
  }
  .sd-titles h2 { font-size: 18px; font-weight: 700; color: white; }
  .sd-titles p { font-size: 11px; color: #93C5FD; font-weight: 300; margin-top: 3px; }
  .sd-badge {
    margin-left: auto;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.5px;
    padding: 4px 10px;
    border-radius: 3px;
    flex-shrink: 0;
  }

  /* ── SECTION ── */
  .section {
    background: white;
    padding: 44px 80px;
    margin-bottom: 8px;
    border-bottom: 1px solid var(--mid);
  }

  /* ── CALLOUTS ── */
  .callout {
    border-radius: 5px;
    padding: 14px 18px;
    font-size: 12px;
    line-height: 1.8;
    margin-bottom: 24px;
  }
  .callout-blue  { background: #EEF2FA; border: 1.5px solid var(--blue); }
  .callout-amber { background: var(--amber-bg); border: 1.5px solid var(--amber); }
  .callout-green { background: var(--green-bg); border: 1.5px solid var(--green); }
  .callout-red   { background: var(--red-bg); border: 1.5px solid var(--red); }
  .callout-navy  { background: var(--light); border: 1.5px solid var(--navy); }

  /* ── MONO LABEL ── */
  .mono-label {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    color: var(--grey);
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-bottom: 14px;
  }

  /* ── MODULE GRID ── */
  .module-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 28px; }
  .module-grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 28px; }
  .module-card { border-radius: 5px; overflow: hidden; border: 1.5px solid; }
  .module-card-head { padding: 10px 14px; font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
  .module-card-body { padding: 12px 14px; background: white; font-size: 11px; color: var(--slate); line-height: 1.85; }
  .module-card-body ul { list-style: none; }
  .module-card-body li { display: flex; align-items: flex-start; gap: 6px; margin-bottom: 2px; }
  .module-card-body li::before { content: '—'; opacity: 0.35; flex-shrink: 0; margin-top: 1px; }

  /* ── SCOPE TABLE ── */
  table.scope {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    margin-bottom: 24px;
  }
  table.scope th {
    padding: 9px 14px;
    text-align: left;
    font-weight: 700;
    font-size: 10px;
    background: var(--navy);
    color: white;
  }
  table.scope td {
    padding: 9px 14px;
    border-bottom: 1px solid #E2E8F0;
    vertical-align: top;
    line-height: 1.7;
  }
  table.scope tr:nth-child(even) td { background: #F8FAFF; }
  table.scope td:first-child { font-family: 'IBM Plex Mono', monospace; font-size: 10px; font-weight: 600; color: var(--navy); white-space: nowrap; width: 200px; }
  table.scope td.in  { color: var(--green);  font-weight: 700; text-align: center; width: 60px; font-size: 15px; }
  table.scope td.out { color: #CBD5E1; font-weight: 700; text-align: center; width: 60px; font-size: 15px; }
  table.scope td.why { font-size: 10px; color: var(--grey); font-style: italic; }

  /* ── SPEC TABLE ── */
  table.spec {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    margin-bottom: 20px;
  }
  table.spec th {
    background: var(--navy);
    color: white;
    padding: 8px 12px;
    text-align: left;
    font-weight: 600;
    font-size: 10px;
  }
  table.spec td {
    padding: 9px 12px;
    border-bottom: 1px solid #E2E8F0;
    vertical-align: top;
    line-height: 1.7;
  }
  table.spec tr:nth-child(even) td { background: #F8FAFF; }
  table.spec td:first-child {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    color: var(--navy);
    font-weight: 600;
    width: 180px;
  }

  /* ── FLOW NODES ── */
  .flow { display: flex; align-items: flex-start; gap: 0; flex-wrap: nowrap; overflow-x: auto; padding: 24px 0 8px; }
  .node { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
  .node-box {
    border-radius: 5px;
    padding: 10px 16px;
    font-size: 11px;
    font-weight: 600;
    text-align: center;
    min-width: 130px;
    max-width: 160px;
    line-height: 1.35;
  }
  .node-sub { font-size: 10px; font-weight: 400; margin-top: 3px; opacity: 0.8; }
  .node-label { font-family: 'IBM Plex Mono', monospace; font-size: 9px; color: var(--grey); margin-top: 5px; text-align: center; max-width: 140px; line-height: 1.3; }
  .arrow { display: flex; align-items: center; flex-shrink: 0; margin-top: 14px; padding: 0 4px; }
  .arrow .line { height: 2px; width: 28px; background: var(--mid); }
  .arrow .head { width: 0; height: 0; border-top: 5px solid transparent; border-bottom: 5px solid transparent; border-left: 7px solid var(--mid); }

  .n-navy   { background: var(--navy);    color: white; }
  .n-blue   { background: var(--blue);    color: white; }
  .n-blue2  { background: #EEF2FA; color: var(--navy); border: 1.5px solid var(--blue); }
  .n-teal   { background: var(--teal);    color: white; }
  .n-teal2  { background: var(--teal-lt); color: var(--teal); border: 1.5px solid var(--teal); }
  .n-purple { background: var(--purple);  color: white; }
  .n-amber2 { background: var(--amber-bg); color: var(--amber); border: 1.5px solid var(--amber); }
  .n-green  { background: var(--green);   color: white; }
  .n-green2 { background: var(--green-bg); color: var(--green); border: 1.5px solid var(--green); }

  /* ── DATA MODEL ── */
  .entity-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
  .entity-card { border-radius: 5px; overflow: hidden; border: 1.5px solid var(--mid); }
  .entity-head {
    background: var(--navy);
    color: white;
    padding: 8px 14px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.5px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .entity-head .badge {
    font-size: 8px;
    letter-spacing: 0.5px;
    padding: 2px 6px;
    border-radius: 2px;
    background: rgba(255,255,255,0.15);
    color: #93C5FD;
  }
  .entity-body { padding: 12px 14px; background: white; }
  .field-row { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 5px; font-size: 10px; }
  .field-name { font-family: 'IBM Plex Mono', monospace; color: var(--blue); font-weight: 500; flex-shrink: 0; min-width: 120px; }
  .field-type { color: var(--grey); font-style: italic; flex-shrink: 0; min-width: 70px; }
  .field-note { color: var(--slate); font-size: 10px; line-height: 1.4; }
  .field-pk   { color: var(--amber); font-weight: 700; }
  .field-fk   { color: var(--teal); }
  .entity-rel { padding: 8px 14px; background: #F8FAFF; border-top: 1px solid var(--mid); font-size: 10px; color: var(--grey); font-family: 'IBM Plex Mono', monospace; line-height: 1.8; }

  /* ── USER STORY ── */
  .story-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
  .story {
    display: flex;
    gap: 12px;
    background: #F8FAFF;
    border: 1px solid var(--mid);
    border-left: 3px solid;
    border-radius: 0 4px 4px 0;
    padding: 10px 14px;
    font-size: 11px;
    line-height: 1.7;
    align-items: flex-start;
  }
  .story-id { font-family: 'IBM Plex Mono', monospace; font-size: 9px; font-weight: 700; color: var(--grey); flex-shrink: 0; min-width: 50px; margin-top: 1px; }
  .story-text { color: var(--slate); }
  .story-text strong { color: var(--navy); }

  /* ── OUT OF SCOPE GRID ── */
  .oos-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 24px; }
  .oos-card {
    border-radius: 4px;
    border: 1px solid #E2E8F0;
    padding: 12px 16px;
    background: white;
    display: flex;
    gap: 10px;
    align-items: flex-start;
    font-size: 11px;
  }
  .oos-x { font-size: 16px; color: #CBD5E1; flex-shrink: 0; line-height: 1.2; }
  .oos-content h4 { font-size: 11px; font-weight: 700; color: var(--slate); margin-bottom: 3px; }
  .oos-content p { font-size: 10px; color: var(--grey); line-height: 1.6; }

  /* ── PORTAL CARDS ── */
  .portal-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 28px; }
  .portal-card { border-radius: 6px; overflow: hidden; border: 2px solid; }
  .portal-head { padding: 14px 18px; color: white; }
  .portal-head h3 { font-size: 16px; font-weight: 700; }
  .portal-head .role { font-family: 'IBM Plex Mono', monospace; font-size: 9px; opacity: 0.7; letter-spacing: 1px; text-transform: uppercase; margin-top: 2px; }
  .portal-body { padding: 14px 18px; background: white; font-size: 11px; color: var(--slate); line-height: 1.85; }
  .portal-body ul { list-style: none; }
  .portal-body li { display: flex; gap: 6px; margin-bottom: 4px; align-items: flex-start; }
  .portal-body li::before { content: '✓'; color: var(--green); flex-shrink: 0; font-size: 10px; margin-top: 2px; }

  /* ── CODE BLOCK ── */
  .code-block {
    background: var(--ink);
    border-radius: 5px;
    padding: 16px 20px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    line-height: 2;
    margin-bottom: 20px;
    overflow-x: auto;
  }
  .c-comment { color: #475569; }
  .c-key     { color: #7DD3FC; }
  .c-val     { color: #86EFAC; }
  .c-op      { color: #F9A8D4; }
  .c-warn    { color: #FCD34D; }
  .c-str     { color: #A5F3FC; }

  /* ── TWO / THREE COL ── */
  .two-col   { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  .three-col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }

  /* ── TECH STACK ── */
  .stack-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 24px; }
  .stack-card {
    border-radius: 5px;
    border: 1.5px solid var(--mid);
    padding: 14px 16px;
    background: white;
  }
  .stack-card h4 { font-family: 'IBM Plex Mono', monospace; font-size: 10px; font-weight: 700; color: var(--navy); letter-spacing: 0.3px; margin-bottom: 8px; }
  .stack-card .items { font-size: 10px; color: var(--slate); line-height: 1.9; }

  /* ── FEEDBACK TABLE ── */
  .feedback-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .feedback-col { }
  .feedback-col h4 { font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: var(--grey); margin-bottom: 10px; }
  .q-list { display: flex; flex-direction: column; gap: 6px; }
  .q-item { background: #F8FAFF; border: 1px solid var(--mid); border-left: 3px solid var(--blue); border-radius: 0 4px 4px 0; padding: 8px 12px; font-size: 11px; color: var(--slate); line-height: 1.6; }

  /* ── FOOTER ── */
  .doc-footer {
    padding: 22px 80px;
    border-top: 1px solid var(--mid);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: white;
  }
  .doc-footer span { font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: var(--grey); }

  @media print {
    body { background: white; font-size: 11px; }
    .cover { padding: 40px; }
    .section { padding: 32px 40px; }
    .section-divider { padding: 12px 40px; }
    .doc-footer, .status-bar { padding: 16px 40px; }
    .cover, .section-divider, .status-bar { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>

<!-- COVER -->
<div class="cover">
  <div>
    <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#3B82F6;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">Therum Technologies Ltd</div>
    <h1>MVP Alpha / Beta<br>Build Specification</h1>
    <div class="sub">Therum Core — Scoped for 3–5 Design Partners · Dev Agency Brief</div>
  </div>
  <div class="cover-meta">
    <div>Document</div>
    <div class="ver">THERUM-DEV-001</div>
    <div style="margin-top:10px;">Version</div>
    <div class="ver">v1.5 · April 2026</div>
    <div style="margin-top:10px;">Classification</div>
    <div class="ver">Confidential</div>
    <div style="margin-top:10px;">Author</div>
    <div class="ver">Bhavik Patel · Founder</div>
  </div>
</div>

<!-- STATUS BAR -->
<div class="status-bar">
  <div class="status-item">
    <div class="status-label">Phase</div>
    <div class="status-val">Alpha / Beta MVP</div>
  </div>
  <div class="status-sep"></div>
  <div class="status-item">
    <div class="status-label">Product Scope</div>
    <div class="status-val">Therum Core Only</div>
  </div>
  <div class="status-sep"></div>
  <div class="status-item">
    <div class="status-label">Target Testers</div>
    <div class="status-val">3–5 UK Talent Agencies</div>
  </div>
  <div class="status-sep"></div>
  <div class="status-item">
    <div class="status-label">Tech Foundation</div>
    <div class="status-val">Existing React SPA Prototype</div>
  </div>
  <div class="status-sep"></div>
  <div class="status-item">
    <div class="status-label">Core Hypothesis</div>
    <div class="status-val">INV/SBI/COM + Xero = right model for UK agencies</div>
  </div>
</div>


<!-- ═══ SECTION 1: OVERVIEW & PURPOSE ═══ -->
<div class="section-divider" style="background:#1A244E;">
  <div class="sd-num">01</div>
  <div class="sd-titles">
    <h2>Purpose & What We're Testing</h2>
    <p>The MVP hypothesis, tester profile, and success criteria for the alpha build</p>
  </div>
  <div class="sd-badge" style="background:rgba(30,85,204,0.3);color:#93C5FD;border:1px solid rgba(30,85,204,0.5);">READ FIRST</div>
</div>

<div class="section">

  <div class="callout callout-blue">
    <strong style="color:var(--navy);">What this document is:</strong> A scoped build specification for a development agency to design, build, and deliver a functional MVP of Therum Core — the financial operating system for UK talent and influencer management agencies. The MVP is built for 3–5 alpha/beta design partners (real agencies, real data) and must be functional enough to generate genuine workflow feedback, not just a prototype demonstration.
  </div>

  <div class="mono-label">Primary hypothesis</div>
  <div style="background:#0F1623;border-radius:5px;padding:18px 24px;margin-bottom:28px;font-size:13px;color:#93C5FD;font-family:'IBM Plex Mono',monospace;line-height:1.8;">
    Does the INV/SBI/COM invoice model, linked bidirectionally to Xero, match the actual financial workflow of a UK talent agency — and does the deal/milestone structure correctly reflect how agencies think about and manage their deals?
  </div>

  <div class="mono-label">Secondary hypotheses to validate</div>
  <div class="three-col" style="margin-bottom:28px;">
    <div style="background:#F8FAFF;border:1.5px solid var(--mid);border-radius:5px;padding:14px 16px;font-size:11px;color:var(--slate);line-height:1.8;">
      <strong style="color:var(--navy);display:block;margin-bottom:6px;">Finance / Agency portal split</strong>
      Is the two-portal UX model (Agency portal for agents, Finance portal for FDs/bookkeepers) the right pattern, or do smaller agencies want a single login with role-based views?
    </div>
    <div style="background:#F8FAFF;border:1.5px solid var(--mid);border-radius:5px;padding:14px 16px;font-size:11px;color:var(--slate);line-height:1.8;">
      <strong style="color:var(--navy);display:block;margin-bottom:6px;">VAT threshold value</strong>
      Does the rolling VAT monitor surface something genuinely new to agencies, or are they already tracking this elsewhere? Is the three-tier alert (£75k/£85k/£90k) meaningful or confusing?
    </div>
    <div style="background:#F8FAFF;border:1.5px solid var(--mid);border-radius:5px;padding:14px 16px;font-size:11px;color:var(--slate);line-height:1.8;">
      <strong style="color:var(--navy);display:block;margin-bottom:6px;">Payout calculation accuracy</strong>
      Does the net payout calculation (Gross SBI minus commission) match what agencies currently compute manually? Are there edge cases (mother agency splits, multi-party deals) the model doesn't handle?
    </div>
  </div>

  <div class="mono-label">Target tester profile</div>
  <div class="two-col" style="margin-bottom:28px;">
    <div>
      <table class="spec">
        <thead><tr><th>Attribute</th><th>Target</th></tr></thead>
        <tbody>
          <tr><td>Agency type</td><td>UK talent representation, influencer management, or full-service (both)</td></tr>
          <tr><td>Roster size</td><td>5–50 active talent (sweet spot for MVP)</td></tr>
          <tr><td>Accounting</td><td>Uses Xero (mandatory for Xero integration testing)</td></tr>
          <tr><td>Current tools</td><td>Spreadsheets, Wrike, MARS, or nothing purpose-built</td></tr>
          <tr><td>Role testing</td><td>Ideally one person as "agent" + one as "FD/bookkeeper" per tester</td></tr>
          <tr><td>Willingness</td><td>Willing to enter real (or representative) historical deal data</td></tr>
        </tbody>
      </table>
    </div>
    <div>
      <div class="callout callout-amber" style="margin-bottom:0;">
        <strong style="color:var(--amber);">Important — data quality:</strong> Testers using dummy data will not generate useful feedback. The VAT monitor is meaningless without real historical SBI totals. The payout maths only lands when it matches something they've done manually before. During onboarding, testers should be guided to enter their last 3 months of real deal activity. This is a condition of the design partner relationship, not optional.
      </div>
    </div>
  </div>

  <div class="mono-label">MVP success criteria</div>
  <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:0;">
    <div style="display:flex;gap:12px;align-items:flex-start;font-size:11px;color:var(--slate);line-height:1.7;">
      <div style="min-width:28px;height:28px;background:var(--blue);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:11px;flex-shrink:0;margin-top:1px;">1</div>
      <div>At least 3 of 5 testers complete the full deal-to-invoice-to-Xero flow without requiring manual workarounds or support intervention</div>
    </div>
    <div style="display:flex;gap:12px;align-items:flex-start;font-size:11px;color:var(--slate);line-height:1.7;">
      <div style="min-width:28px;height:28px;background:var(--blue);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:11px;flex-shrink:0;margin-top:1px;">2</div>
      <div>Xero invoices pushed by Therum are accepted by testers' Xero accounts with correct account code mapping, contact linking, and payment terms — no manual correction needed in Xero</div>
    </div>
    <div style="display:flex;gap:12px;align-items:flex-start;font-size:11px;color:var(--slate);line-height:1.7;">
      <div style="min-width:28px;height:28px;background:var(--blue);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:11px;flex-shrink:0;margin-top:1px;">3</div>
      <div>VAT monitor correctly calculates rolling SBI totals against testers' own historical invoice data and testers agree the thresholds are accurate</div>
    </div>
    <div style="display:flex;gap:12px;align-items:flex-start;font-size:11px;color:var(--slate);line-height:1.7;">
      <div style="min-width:28px;height:28px;background:var(--blue);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:11px;flex-shrink:0;margin-top:1px;">4</div>
      <div>Feedback sessions produce clear signal on: what's missing, what's wrong in the data model, and whether the product solves a real enough pain to justify a paid subscription</div>
    </div>
  </div>

</div>


<!-- ═══ SECTION 2: SCOPE ═══ -->
<div class="section-divider" style="background:#1A244E;">
  <div class="sd-num">02</div>
  <div class="sd-titles">
    <h2>Scope — In vs. Out</h2>
    <p>What is built for MVP and what is deliberately deferred — with rationale for every exclusion</p>
  </div>
  <div class="sd-badge" style="background:rgba(30,85,204,0.3);color:#93C5FD;border:1px solid rgba(30,85,204,0.5);">SCOPE BOUNDARY</div>
</div>

<div class="section">

  <div class="callout callout-navy">
    <strong style="color:var(--navy);">Scope principle:</strong> Every item in this MVP is either load-bearing (without it, the primary hypothesis cannot be tested) or a high-value signal generator (a feature that will produce clear yes/no feedback from testers). Every exclusion is deliberate — cutting it reduces build time without removing signal. Nothing has been cut because it's unimportant; it's been cut because it can be validated later.
  </div>

  <div class="mono-label">Feature scope table</div>
  <table class="scope">
    <thead>
      <tr>
        <th style="width:220px;">Feature</th>
        <th style="width:60px;text-align:center;">MVP</th>
        <th>What's included / what's deferred</th>
        <th style="width:200px;">Rationale</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td colspan="4" style="background:var(--navy);color:#93C5FD;font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:1px;text-transform:uppercase;padding:5px 14px;">Deal & Pipeline</td>
      </tr>
      <tr>
        <td>Deal pipeline (Kanban)</td>
        <td class="in">✓</td>
        <td>Stages: Pipeline → Contracted → Active → Completed. Manual deal creation. Client and talent linked per deal. Commission rate per deal (overrides talent default).</td>
        <td class="why">Load-bearing — milestone invoicing requires a deal to exist</td>
      </tr>
      <tr>
        <td>Milestone management</td>
        <td class="in">✓</td>
        <td>Multiple milestones per deal, each with amount, due date, and deliverable description. Milestone completion triggers invoice generation.</td>
        <td class="why">Load-bearing — the INV/SBI/COM triplet is milestone-triggered</td>
      </tr>
      <tr>
        <td>Table view (deals)</td>
        <td class="in">✓</td>
        <td>Sortable list view as alternative to Kanban. Filterable by talent, stage, date range.</td>
        <td class="why">Standard pattern — Kanban alone insufficient for data-heavy agencies</td>
      </tr>
      <tr>
        <td>AI contract ingestion</td>
        <td class="out">—</td>
        <td>Deferred. All deal creation manual in MVP.</td>
        <td class="why">Tests deal <em>data model</em> correctness first, before automating it</td>
      </tr>
      <tr>
        <td colspan="4" style="background:var(--navy);color:#93C5FD;font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:1px;text-transform:uppercase;padding:5px 14px;">Client & Talent Records</td>
      </tr>
      <tr>
        <td>Client records</td>
        <td class="in">✓</td>
        <td>Client Organisation record (name, payment terms, Xero contact link). Multi-contact via ClientContact child entity — each contact has name, email, role (PRIMARY / FINANCE / OTHER). Min 1 PRIMARY required. FINANCE contact used as "Attention:" on INV and as chase target for overdue workflow. All contacts synced to Xero as ContactPersons on the single Organisation record.</td>
        <td class="why">Multi-contact is load-bearing — brand marketing contact ≠ AP contact; chasing the wrong person damages client relationships and breaks the AI collections workflow in V2</td>
      </tr>
      <tr>
        <td>Talent records</td>
        <td class="in">✓</td>
        <td>Name, contact details, default commission rate, VAT registration status + number, Talent Portal invite toggle. Stripe account reference (stored but not executed in MVP).</td>
        <td class="why">Required for SBI/COM generation and VAT monitoring</td>
      </tr>
      <tr>
        <td>Social analytics / media packs</td>
        <td class="out">—</td>
        <td>Deferred to Represent (Phase 2).</td>
        <td class="why">Not relevant to financial hypothesis being tested</td>
      </tr>
      <tr>
        <td colspan="4" style="background:var(--navy);color:#93C5FD;font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:1px;text-transform:uppercase;padding:5px 14px;">Invoice Engine — INV / SBI / COM</td>
      </tr>
      <tr>
        <td>INV/SBI/COM generation</td>
        <td class="in">✓</td>
        <td>Full triplet generated atomically on milestone completion. Model determined by agency.invoicingModel set at onboarding. SELF_BILLING: INV (ACCREC) + SBI (ACCPAY) + COM (ACCREC). ON_BEHALF: OBI (ACCREC, talent named as supplier) + CN (credit note zeroing OBI) + COM (ACCREC). PDF generated for all documents. Finance Portal approval required before Xero push.</td>
        <td class="why">This is the product. Both models must be supported — different agencies invoice differently. Non-negotiable.</td>
      </tr>
      <tr>
        <td>Invoice approval workflow</td>
        <td class="in">✓</td>
        <td>Finance Portal invoice queue. Each triplet requires FD approval before Xero push. Approve or reject with notes.</td>
        <td class="why">Core differentiator — tests whether FD approval step resonates</td>
      </tr>
      <tr>
        <td>Invoice PDF generation</td>
        <td class="in">✓</td>
        <td>Downloadable PDF for all invoice types. Therum-branded template. Correct invoice numbering per series (INV-XXXX / SBI-XXXX / OBI-XXXX / COM-XXXX / MCN-XXXX). <strong>Invoice date on PDF = triplet.invoiceDate</strong> — set by agent on milestone, editable by FD in Invoice Queue before push. PDF regenerated automatically if date is amended before push.</td>
        <td class="why">Testers need to compare Therum output against their current invoices — date accuracy is a basic compliance requirement</td>
      </tr>
      <tr>
        <td>Manual credit notes</td>
        <td class="in">✓</td>
        <td>Finance Portal Credit Notes screen. FD raises CN against any approved triplet — full or partial amount, required reason, date (defaults today). If requiresReplacement = true: original milestone CANCELLED, agent notified, deal card shows amber badge until replacement milestone created. CN PDF generated and pushed to Xero (MCN-XXXX series).</td>
        <td class="why">Agencies need to correct invoicing errors — a system without CN capability cannot be a complete financial operations tool</td>
      </tr>
      <tr>
        <td>Overdue invoice tracking</td>
        <td class="in">✓</td>
        <td>Overdue invoice list in Finance Portal. Days overdue, amount, client. Manual chase note logging. No AI drafting in MVP.</td>
        <td class="why">Validates that the Finance Portal is useful beyond just approvals</td>
      </tr>
      <tr>
        <td>Deal expenses</td>
        <td class="in">✓</td>
        <td>Expenses added to a deal or pinned to a milestone. Two flags per expense: <strong>rechargeable</strong> (injected as line item on INV) and <strong>contractSignOff</strong> (pre-approved in contract). Rechargeable expenses included in INV at generation — separate Xero account code. Non-rechargeable talent expenses deducted from payout, itemised on remittance statement. Finance Portal expense approval queue (separate from invoice queue). Contract sign-off warning on INV approval if any rechargeable expense lacks contractSignOff — FD must confirm before dispatch. Receipt upload per expense. Status flow: PENDING → APPROVED → INVOICED / EXCLUDED.</td>
        <td class="why">Rechargeable expenses are routine in talent agency deals — travel, accommodation, production. Not supporting them forces a workaround that breaks invoice accuracy</td>
      </tr>
      <tr>
        <td>AI collections drafting</td>
        <td class="out">—</td>
        <td>Deferred. Manual chase logging only in MVP.</td>
        <td class="why">Tests the collections <em>workflow</em> before automating it</td>
      </tr>
      <tr>
        <td colspan="4" style="background:var(--navy);color:#93C5FD;font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:1px;text-transform:uppercase;padding:5px 14px;">Xero Integration</td>
      </tr>
      <tr>
        <td>Xero OAuth connect</td>
        <td class="in">✓</td>
        <td>OAuth 2.0 connection flow from Finance Portal settings. Stores access token, refresh token, tenantId per agency.</td>
        <td class="why">Required to test the Xero integration hypothesis</td>
      </tr>
      <tr>
        <td>Contact sync</td>
        <td class="in">✓</td>
        <td>Push Client as Xero Organisation (IsCustomer=true) with all ClientContacts as Xero ContactPersons. FINANCE role contact gets IncludeInEmails=true. Push talent contacts (IsSupplier=true). Deduplication by email. Store returned Xero ContactID on Client/Talent record.</td>
        <td class="why">Required for invoice push to reference correct Xero contacts; ContactPersons ensure Xero invoice emails reach the right person at the brand</td>
      </tr>
      <tr>
        <td>Invoice push (INV/SBI/COM)</td>
        <td class="in">✓</td>
        <td>On Finance Portal approval: push INV as ACCREC, SBI as ACCPAY, COM as ACCREC. Each with correct Therum invoice reference, account code, amounts, tax, and due date. Therum invoiceId stored against Xero InvoiceID for status sync.</td>
        <td class="why">Core to the hypothesis — Xero must show correct entries</td>
      </tr>
      <tr>
        <td>Xero webhook (INV paid status)</td>
        <td class="in">✓</td>
        <td>Webhook endpoint for Xero invoice status events. When INV is marked paid in Xero, portal status updates to PAID. This unlocks payout calculation in MVP.</td>
        <td class="why">Without this, testers must manually update payment status — breaks the flow</td>
      </tr>
      <tr>
        <td>QuickBooks / Sage integration</td>
        <td class="out">—</td>
        <td>Deferred. Xero only in MVP. Note: accounting abstraction layer should still be architected from day one — XeroProvider implements AccountingProvider interface — so adding QuickBooks later is a new provider, not a restructure.</td>
        <td class="why">All target design partners use Xero</td>
      </tr>
      <tr>
        <td colspan="4" style="background:var(--navy);color:#93C5FD;font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:1px;text-transform:uppercase;padding:5px 14px;">VAT Threshold Monitor</td>
      </tr>
      <tr>
        <td>Rolling VAT threshold monitor</td>
        <td class="in">✓</td>
        <td>Rolling 12-month SBI gross total per talent. Three tiers: Approaching £75k / Imminent £85k / Breached £90k. Suppressed if talent.vatRegistered = true. Displayed in both Agency and Finance Portals.</td>
        <td class="why">Unique feature — generates strong tester reactions, key signal item</td>
      </tr>
      <tr>
        <td>Pipeline-projected breach date</td>
        <td class="in">✓</td>
        <td>Forward projection using contracted (not just invoiced) deal values. Shows estimated breach date based on current pipeline.</td>
        <td class="why">The forward projection is the differentiator — historical total alone is table stakes</td>
      </tr>
      <tr>
        <td>VAT email alert</td>
        <td class="out">—</td>
        <td>Deferred. In-portal alerts only in MVP. Email notifications added post-beta.</td>
        <td class="why">Reduces infrastructure complexity; portal alert sufficient for testing the concept</td>
      </tr>
      <tr>
        <td colspan="4" style="background:var(--navy);color:#93C5FD;font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:1px;text-transform:uppercase;padding:5px 14px;">Payout Engine</td>
      </tr>
      <tr>
        <td>Net payout calculation</td>
        <td class="in">✓</td>
        <td>Net payout = Gross SBI − Commission. Calculated and displayed per milestone once INV is marked PAID. Finance Portal shows a "payout run summary" for manual bank transfer (not executed via Stripe in MVP). Remittance statement PDF generated per talent.</td>
        <td class="why">Tests payout maths correctness without routing real money through an unproven system</td>
      </tr>
      <tr>
        <td>Stripe Connect live execution</td>
        <td class="out">—</td>
        <td>Deferred post-beta. In MVP, Therum generates the payout summary and remittance statement; the agency makes the bank transfer manually. Stripe architecture should be designed now (Express accounts, transfer_group, metadata schema) but not wired to live money movement.</td>
        <td class="why">Real money routing requires higher trust than an alpha build warrants; correctness of maths validated first</td>
      </tr>
      <tr>
        <td colspan="4" style="background:var(--navy);color:#93C5FD;font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:1px;text-transform:uppercase;padding:5px 14px;">Portals & Access</td>
      </tr>
      <tr>
        <td>Agency Portal</td>
        <td class="in">✓</td>
        <td>Deal pipeline, milestone management, client/talent records, VAT alerts. See Section 05 for full feature list.</td>
        <td class="why">Primary user-facing portal — agents live here</td>
      </tr>
      <tr>
        <td>Finance Portal</td>
        <td class="in">✓</td>
        <td>Invoice approval queue, payout run summary, Xero sync status, VAT compliance dashboard, overdue invoice monitor. See Section 05.</td>
        <td class="why">Tests the FD/bookkeeper UX pattern that no competitor offers</td>
      </tr>
      <tr>
        <td>Talent Portal</td>
        <td class="in">✓</td>
        <td>Read-only in MVP: own deal visibility, milestone status, payout schedule, remittance statements. Invite sent via toggle on talent record.</td>
        <td class="why">Talent reaction to having this is signal — do they want it? Does agency want talent to have it?</td>
      </tr>
      <tr>
        <td>Admin Portal (internal)</td>
        <td class="out">—</td>
        <td>Deferred. Direct database/Stripe dashboard access sufficient for 3–5 beta testers managed directly by Therum.</td>
        <td class="why">Operational overhead not justified at this scale</td>
      </tr>
      <tr>
        <td>Talent mobile app</td>
        <td class="out">—</td>
        <td>Deferred to Represent phase. Web-responsive Talent Portal sufficient for MVP.</td>
        <td class="why">Native app build cost not justified until Talent Portal value is confirmed</td>
      </tr>
    </tbody>
  </table>

</div>


<!-- ═══ SECTION 3: DATA MODEL ═══ -->
<div class="section-divider" style="background:#1A244E;">
  <div class="sd-num">03</div>
  <div class="sd-titles">
    <h2>Data Model</h2>
    <p>Core entities, fields, and relationships — the canonical schema for MVP</p>
  </div>
  <div class="sd-badge" style="background:rgba(30,85,204,0.3);color:#93C5FD;border:1px solid rgba(30,85,204,0.5);">SCHEMA REFERENCE</div>
</div>

<div class="section">

  <div class="callout callout-blue">
    <strong style="color:var(--navy);">Architecture note:</strong> All invoice logic (INV/SBI/COM) must be scoped to <strong>milestoneId</strong>, not dealId. A deal with three milestones has three separate invoice triplets and three separate payout states. Tracking at deal level is architecturally incorrect and will cause disbursement errors on multi-milestone deals. This is a ground-up decision — it cannot be retrofitted.
  </div>

  <div class="mono-label">Core entities</div>
  <div class="entity-grid">

    <div class="entity-card">
      <div class="entity-head">Agency <div class="badge">TENANT</div></div>
      <div class="entity-body">
        <div class="field-row"><span class="field-name field-pk">id</span><span class="field-type">UUID</span><span class="field-note">Primary key</span></div>
        <div class="field-row"><span class="field-name">name</span><span class="field-type">String</span><span class="field-note">Agency trading name</span></div>
        <div class="field-row"><span class="field-name">slug</span><span class="field-type">String</span><span class="field-note">URL slug (unique)</span></div>
        <div class="field-row"><span class="field-name">planTier</span><span class="field-type">Enum</span><span class="field-note">BETA · SMALL · MID · LARGE</span></div>
        <div class="field-row"><span class="field-name">xeroTenantId</span><span class="field-type">String?</span><span class="field-note">Null until Xero connected</span></div>
        <div class="field-row"><span class="field-name">xeroTokens</span><span class="field-type">Encrypted</span><span class="field-note">Access + refresh tokens</span></div>
        <div class="field-row"><span class="field-name">stripeAccountId</span><span class="field-type">String?</span><span class="field-note">Platform Connect account — store even if not live in MVP</span></div>
        <div class="field-row"><span class="field-name">commissionDefault</span><span class="field-type">Decimal</span><span class="field-note">Agency-wide default commission %</span></div>
        <div class="field-row"><span class="field-name">invoicingModel</span><span class="field-type">Enum</span><span class="field-note">SELF_BILLING · ON_BEHALF — set at onboarding, applies to all deals. See Section 04.</span></div>
        <div class="field-row"><span class="field-name">vatRegistered</span><span class="field-type">Boolean</span><span class="field-note">If false: INV and COM must not charge VAT — blocks invoice generation with warning</span></div>
        <div class="field-row"><span class="field-name">vatNumber</span><span class="field-type">String?</span><span class="field-note">Agency VAT registration number — appears on all INV and COM PDFs</span></div>
        <div class="field-row"><span class="field-name">xeroAccountCodes</span><span class="field-type">JSON</span><span class="field-note">Maps INV/SBI/COM to Xero account codes</span></div>
      </div>
      <div class="entity-rel">Root tenant. All other entities scoped to agencyId. vatRegistered must be true for standard invoice generation — mirrors the talent vatRegistered pattern.</div>
    </div>

    <div class="entity-card">
      <div class="entity-head">Client <div class="badge">BRAND / BUYER</div></div>
      <div class="entity-body">
        <div class="field-row"><span class="field-name field-pk">id</span><span class="field-type">UUID</span><span class="field-note">Primary key</span></div>
        <div class="field-row"><span class="field-name field-fk">agencyId</span><span class="field-type">FK → Agency</span></div>
        <div class="field-row"><span class="field-name">name</span><span class="field-type">String</span><span class="field-note">Brand / company name</span></div>
        <div class="field-row"><span class="field-name">paymentTermsDays</span><span class="field-type">Int</span><span class="field-note">Default: 30. Used on INV.</span></div>
        <div class="field-row"><span class="field-name">xeroContactId</span><span class="field-type">String?</span><span class="field-note">Null until Xero sync. IsCustomer=true</span></div>
        <div class="field-row"><span class="field-name">vatNumber</span><span class="field-type">String?</span><span class="field-note">For reverse charge scenarios</span></div>
        <div class="field-row"><span class="field-name">notes</span><span class="field-type">Text?</span></div>
        <div style="margin-top:8px;padding:6px 8px;background:#EEF2FA;border-radius:3px;font-size:9px;color:var(--navy);font-family:'IBM Plex Mono',monospace;line-height:1.6;">No contactName / email fields here.<br>All contacts live on ClientContact child entity.</div>
      </div>
      <div class="entity-rel">Has many ClientContacts. At least one must have role = PRIMARY. xeroContactId populated on first contact push — maps to a single Xero Organisation record with ContactPersons attached.</div>
    </div>

    <div class="entity-card">
      <div class="entity-head">Talent <div class="badge">CREATOR / TALENT</div></div>
      <div class="entity-body">
        <div class="field-row"><span class="field-name field-pk">id</span><span class="field-type">UUID</span><span class="field-note">Primary key</span></div>
        <div class="field-row"><span class="field-name field-fk">agencyId</span><span class="field-type">FK → Agency</span></div>
        <div class="field-row"><span class="field-name">name</span><span class="field-type">String</span></div>
        <div class="field-row"><span class="field-name">email</span><span class="field-type">String</span><span class="field-note">Used for portal invite</span></div>
        <div class="field-row"><span class="field-name">commissionRate</span><span class="field-type">Decimal</span><span class="field-note">Default rate. Overridable per deal.</span></div>
        <div class="field-row"><span class="field-name">vatRegistered</span><span class="field-type">Boolean</span><span class="field-note">If true: VAT monitor suppressed</span></div>
        <div class="field-row"><span class="field-name">vatNumber</span><span class="field-type">String?</span><span class="field-note">Appears on SBI if registered</span></div>
        <div class="field-row"><span class="field-name">xeroContactId</span><span class="field-type">String?</span><span class="field-note">IsSupplier=true in Xero</span></div>
        <div class="field-row"><span class="field-name">stripeAccountId</span><span class="field-type">String?</span><span class="field-note">Express account ref — store for V2</span></div>
        <div class="field-row"><span class="field-name">portalEnabled</span><span class="field-type">Boolean</span><span class="field-note">Talent Portal invite sent on enable</span></div>
      </div>
      <div class="entity-rel">vatRegistered suppresses VAT monitor. commissionRate overridden at Deal level.</div>
    </div>

    <div class="entity-card">
      <div class="entity-head">Deal <div class="badge">PIPELINE RECORD</div></div>
      <div class="entity-body">
        <div class="field-row"><span class="field-name field-pk">id</span><span class="field-type">UUID</span><span class="field-note">Primary key</span></div>
        <div class="field-row"><span class="field-name field-fk">agencyId</span><span class="field-type">FK → Agency</span></div>
        <div class="field-row"><span class="field-name field-fk">clientId</span><span class="field-type">FK → Client</span></div>
        <div class="field-row"><span class="field-name field-fk">talentId</span><span class="field-type">FK → Talent</span></div>
        <div class="field-row"><span class="field-name">title</span><span class="field-type">String</span><span class="field-note">Deal name / brand campaign title</span></div>
        <div class="field-row"><span class="field-name">stage</span><span class="field-type">Enum</span><span class="field-note">PIPELINE · CONTRACTED · ACTIVE · COMPLETED</span></div>
        <div class="field-row"><span class="field-name">commissionRate</span><span class="field-type">Decimal</span><span class="field-note">Overrides talent default for this deal</span></div>
        <div class="field-row"><span class="field-name">paymentTermsDays</span><span class="field-type">Int?</span><span class="field-note">Null = inherit from client default. Set here if this deal has bespoke terms (e.g. 60-day PO terms vs. client's standard 30).</span></div>
        <div class="field-row"><span class="field-name">currency</span><span class="field-type">String</span><span class="field-note">Default: GBP</span></div>
        <div class="field-row"><span class="field-name">contractRef</span><span class="field-type">String?</span><span class="field-note">Contract reference number</span></div>
        <div class="field-row"><span class="field-name">notes</span><span class="field-type">Text?</span></div>
      </div>
      <div class="entity-rel">Has many Milestones. commissionRate applied to all milestones unless overridden. INV due date = triplet.issuedAt + (deal.paymentTermsDays ?? client.paymentTermsDays).</div>
    </div>

    <div class="entity-card">
      <div class="entity-head">Milestone <div class="badge">INVOICE TRIGGER</div></div>
      <div class="entity-body">
        <div class="field-row"><span class="field-name field-pk">id</span><span class="field-type">UUID</span><span class="field-note">Primary key</span></div>
        <div class="field-row"><span class="field-name field-fk">dealId</span><span class="field-type">FK → Deal</span></div>
        <div class="field-row"><span class="field-name">description</span><span class="field-type">String</span><span class="field-note">Deliverable description</span></div>
        <div class="field-row"><span class="field-name">grossAmount</span><span class="field-type">Decimal</span><span class="field-note">Gross fee for this milestone (£)</span></div>
        <div class="field-row"><span class="field-name">invoiceDate</span><span class="field-type">Date</span><span class="field-note">The date the invoice will be dated — set by agent, editable by FD before push. This is the tax point date that appears on the PDF. INV due date = invoiceDate + paymentTermsDays.</span></div>
        <div class="field-row"><span class="field-name">deliveryDueDate</span><span class="field-type">Date?</span><span class="field-note">Optional — when the deliverable is actually due. Separate from invoiceDate. Often different (e.g. content delivered 15 Mar, invoice dated 1 Apr).</span></div>
        <div class="field-row"><span class="field-name">status</span><span class="field-type">Enum</span><span class="field-note">PENDING · COMPLETE · INVOICED · PAID · PAYOUT_READY · CANCELLED</span></div>
        <div class="field-row"><span class="field-name">completedAt</span><span class="field-type">DateTime?</span><span class="field-note">Set on completion trigger</span></div>
        <div class="field-row"><span class="field-name">payoutStatus</span><span class="field-type">Enum</span><span class="field-note">PENDING · READY · PAID</span></div>
        <div class="field-row"><span class="field-name">payoutDate</span><span class="field-type">Date?</span><span class="field-note">Date payout confirmed</span></div>
        <div class="field-row"><span class="field-name field-fk">cancelledByTripletId</span><span class="field-type">FK → InvoiceTriplet?</span><span class="field-note">Set when a ManualCreditNote cancels this milestone. status → CANCELLED.</span></div>
        <div class="field-row"><span class="field-name field-fk">replacedCancelledMilestoneId</span><span class="field-type">FK → Milestone?</span><span class="field-note">If this is a replacement milestone, points to the cancelled milestone it replaces. Linked by agent at creation.</span></div>
      </div>
      <div class="entity-rel">status = PAID (from Xero webhook) → payoutStatus becomes READY. status = CANCELLED when a ManualCreditNote with requiresReplacement=true is raised — agent notified to create a replacement milestone on the same deal. Has one InvoiceTriplet (unless CANCELLED).</div>
    </div>

    <div class="entity-card">
      <div class="entity-head">InvoiceTriplet <div class="badge">INV · SBI · COM / OBI · CN · COM</div></div>
      <div class="entity-body">
        <div class="field-row"><span class="field-name field-pk">id</span><span class="field-type">UUID</span></div>
        <div class="field-row"><span class="field-name field-fk">milestoneId</span><span class="field-type">FK → Milestone</span><span class="field-note">One triplet per milestone</span></div>
        <div class="field-row"><span class="field-name">invoicingModel</span><span class="field-type">Enum</span><span class="field-note">Snapshot of agency.invoicingModel at generation time</span></div>
        <div style="margin:6px 0 4px;padding:4px 8px;background:#EEF2FA;border-radius:3px;font-family:'IBM Plex Mono',monospace;font-size:9px;color:var(--navy);">SELF_BILLING fields (null if ON_BEHALF)</div>
        <div class="field-row"><span class="field-name">invNumber</span><span class="field-type">String?</span><span class="field-note">INV-XXXX — agency-named client invoice</span></div>
        <div class="field-row"><span class="field-name">sbiNumber</span><span class="field-type">String?</span><span class="field-note">SBI-XXXX — self-billing invoice (ACCPAY)</span></div>
        <div style="margin:6px 0 4px;padding:4px 8px;background:#FEF3C7;border-radius:3px;font-family:'IBM Plex Mono',monospace;font-size:9px;color:var(--amber);">ON_BEHALF fields (null if SELF_BILLING)</div>
        <div class="field-row"><span class="field-name">obiNumber</span><span class="field-type">String?</span><span class="field-note">OBI-XXXX — on behalf invoice, talent named as supplier</span></div>
        <div class="field-row"><span class="field-name">cnNumber</span><span class="field-type">String?</span><span class="field-note">CN-XXXX — credit note zeroing off OBI in agency books</span></div>
        <div class="field-row"><span class="field-name">xeroObiId</span><span class="field-type">String?</span><span class="field-note">Xero InvoiceID for OBI after push</span></div>
        <div class="field-row"><span class="field-name">xeroCnId</span><span class="field-type">String?</span><span class="field-note">Xero CreditNoteID after push</span></div>
        <div style="margin:6px 0 4px;padding:4px 8px;background:var(--green-bg);border-radius:3px;font-family:'IBM Plex Mono',monospace;font-size:9px;color:var(--green);">Shared fields — both models</div>
        <div class="field-row"><span class="field-name">comNumber</span><span class="field-type">String</span><span class="field-note">COM-XXXX — commission invoice (always present)</span></div>
        <div class="field-row"><span class="field-name">grossAmount</span><span class="field-type">Decimal</span><span class="field-note">Stored at generation time — never recalculated</span></div>
        <div class="field-row"><span class="field-name">commissionRate</span><span class="field-type">Decimal</span><span class="field-note">Snapshot of rate at generation time — immutable</span></div>
        <div class="field-row"><span class="field-name">commissionAmount</span><span class="field-type">Decimal</span><span class="field-note">Stored at generation — never recalculated from current rates</span></div>
        <div class="field-row"><span class="field-name">netPayoutAmount</span><span class="field-type">Decimal</span><span class="field-note">Stored at generation — never recalculated</span></div>
        <div class="field-row"><span class="field-name">invoiceDate</span><span class="field-type">Date</span><span class="field-note">The date that appears on the invoice PDF. Set from milestone.invoiceDate at generation. FD can amend before Xero push. This is the VAT tax point date.</span></div>
        <div class="field-row"><span class="field-name">issuedAt</span><span class="field-type">DateTime</span><span class="field-note">System timestamp when Finance Portal approval was given. Distinct from invoiceDate — used for audit trail, not on invoice PDF.</span></div>
        <div class="field-row"><span class="field-name">invDueDateDays</span><span class="field-type">Int</span><span class="field-note">Snapshot of payment terms. Due date = invoiceDate + invDueDateDays.</span></div>
        <div class="field-row"><span class="field-name">approvalStatus</span><span class="field-type">Enum</span><span class="field-note">PENDING · APPROVED · REJECTED</span></div>
        <div class="field-row"><span class="field-name">xeroInvId</span><span class="field-type">String?</span><span class="field-note">Xero ACCREC InvoiceID (SELF_BILLING INV)</span></div>
        <div class="field-row"><span class="field-name">xeroSbiId</span><span class="field-type">String?</span><span class="field-note">Xero ACCPAY InvoiceID (SELF_BILLING SBI)</span></div>
        <div class="field-row"><span class="field-name">xeroComId</span><span class="field-type">String?</span><span class="field-note">Xero InvoiceID for COM (both models)</span></div>
        <div class="field-row"><span class="field-name">invPaidAt</span><span class="field-type">DateTime?</span><span class="field-note">Set by Xero webhook on client invoice payment (INV or OBI)</span></div>
      </div>
      <div class="entity-rel">invoicingModel snapshot determines which field set is populated. invoiceDate is the tax point date on the PDF — editable by FD before Xero push only. issuedAt is set atomically with approvalStatus='APPROVED' inside the complete_xero_push RPC, and is immutable thereafter (DB trigger). All monetary fields immutable after generation. May have one ManualCreditNote raised against it by FD.</div>
    </div>

  </div>

  </div>

  <!-- CLIENT CONTACT ENTITY — full width below the grid -->
  <div class="mono-label" style="margin-top:8px;">ClientContact entity — child of Client</div>
  <div style="border-radius:5px;overflow:hidden;border:1.5px solid var(--mid);margin-bottom:24px;">
    <div class="entity-head" style="background:var(--navy);">ClientContact <div class="badge">CONTACT PERSON</div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;">
      <div class="entity-body" style="border-right:1px solid var(--mid);">
        <div class="field-row"><span class="field-name field-pk">id</span><span class="field-type">UUID</span><span class="field-note">Primary key</span></div>
        <div class="field-row"><span class="field-name field-fk">clientId</span><span class="field-type">FK → Client</span><span class="field-note">Scoped to parent Client</span></div>
        <div class="field-row"><span class="field-name field-fk">agencyId</span><span class="field-type">FK → Agency</span><span class="field-note">For multi-tenancy enforcement</span></div>
        <div class="field-row"><span class="field-name">name</span><span class="field-type">String</span><span class="field-note">Full name of the contact person</span></div>
        <div class="field-row"><span class="field-name">email</span><span class="field-type">String</span><span class="field-note">Contact email — used for invoice "Attention:" field and chase emails</span></div>
        <div class="field-row"><span class="field-name">role</span><span class="field-type">Enum</span><span class="field-note">PRIMARY · FINANCE · OTHER</span></div>
        <div class="field-row"><span class="field-name">phone</span><span class="field-type">String?</span></div>
        <div class="field-row"><span class="field-name">notes</span><span class="field-type">String?</span><span class="field-note">e.g. "AP team, responds Tue–Thu only"</span></div>
      </div>
      <div style="padding:14px 16px;background:white;font-size:11px;color:var(--slate);line-height:1.85;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:var(--grey);letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">Role behaviour rules</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <div style="background:#F8FAFF;border:1px solid var(--mid);border-left:3px solid var(--blue);border-radius:0 3px 3px 0;padding:7px 10px;font-size:10px;line-height:1.65;">
            <strong style="color:var(--navy);">PRIMARY</strong> — Required. At least one contact per Client must be PRIMARY. Used for deal-related correspondence. Falls back to this role if no FINANCE contact exists.
          </div>
          <div style="background:#F8FAFF;border:1px solid var(--mid);border-left:3px solid var(--teal);border-radius:0 3px 3px 0;padding:7px 10px;font-size:10px;line-height:1.65;">
            <strong style="color:var(--teal);">FINANCE</strong> — Optional but important. Used as the "Attention:" name on INV PDFs. Used as the chase contact for overdue invoice workflow. Set <code>IncludeInEmails: true</code> in Xero ContactPersons so Xero's own invoice emails reach AP directly.
          </div>
          <div style="background:#F8FAFF;border:1px solid var(--mid);border-left:3px solid var(--grey);border-radius:0 3px 3px 0;padding:7px 10px;font-size:10px;line-height:1.65;">
            <strong style="color:var(--grey);">OTHER</strong> — Stored for reference only. Not used in any automated workflow.
          </div>
          <div style="margin-top:4px;padding:8px 10px;background:var(--amber-bg);border:1px solid var(--amber);border-radius:3px;font-size:10px;color:var(--slate);line-height:1.65;">
            <strong style="color:var(--amber);">Xero sync:</strong> Therum is source of truth for contacts. On Client push to Xero, all ClientContacts are mapped to Xero <code>ContactPersons</code> on the single Organisation record. FINANCE contact gets <code>IncludeInEmails: true</code>. PRIMARY gets <code>IncludeInEmails: false</code> (unless no FINANCE exists). Max 5 contacts per client in MVP.
          </div>
        </div>
      </div>
    </div>
    <div class="entity-rel">Client (1) → many ClientContacts. Validation: exactly one PRIMARY required. No limit on FINANCE or OTHER in data model — UI caps at 5 total for MVP simplicity.</div>
  </div>

  <!-- CHASE NOTE ENTITY -->
  <div class="mono-label" style="margin-top:8px;">ChaseNote entity — overdue invoice chase log</div>
  <div style="border-radius:5px;overflow:hidden;border:1.5px solid var(--mid);margin-bottom:24px;">
    <div class="entity-head" style="background:var(--navy);">ChaseNote <div class="badge">COLLECTIONS LOG</div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;">
      <div class="entity-body" style="border-right:1px solid var(--mid);">
        <div class="field-row"><span class="field-name field-pk">id</span><span class="field-type">UUID</span><span class="field-note">Primary key</span></div>
        <div class="field-row"><span class="field-name field-fk">invoiceTripletId</span><span class="field-type">FK → InvoiceTriplet</span><span class="field-note">The overdue triplet being chased</span></div>
        <div class="field-row"><span class="field-name field-fk">agencyId</span><span class="field-type">FK → Agency</span><span class="field-note">Multi-tenancy enforcement</span></div>
        <div class="field-row"><span class="field-name field-fk">createdByUserId</span><span class="field-type">FK → User</span><span class="field-note">Finance portal user who logged the note</span></div>
        <div class="field-row"><span class="field-name">contactedName</span><span class="field-type">String</span><span class="field-note">Who was chased — defaults to FINANCE contact, editable</span></div>
        <div class="field-row"><span class="field-name">contactedEmail</span><span class="field-type">String</span><span class="field-note">Email address chased</span></div>
        <div class="field-row"><span class="field-name">method</span><span class="field-type">Enum</span><span class="field-note">EMAIL · PHONE · IN_PERSON · OTHER</span></div>
        <div class="field-row"><span class="field-name">note</span><span class="field-type">Text</span><span class="field-note">Free-text log of what was said / promised</span></div>
        <div class="field-row"><span class="field-name">nextChaseDate</span><span class="field-type">Date?</span><span class="field-note">Optional reminder — surfaces in overdue queue</span></div>
        <div class="field-row"><span class="field-name">createdAt</span><span class="field-type">DateTime</span><span class="field-note">Auto-set on creation</span></div>
      </div>
      <div style="padding:14px 16px;background:white;font-size:11px;color:var(--slate);line-height:1.85;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:var(--grey);letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">Where this appears</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <div style="background:#F8FAFF;border:1px solid var(--mid);border-left:3px solid var(--teal);border-radius:0 3px 3px 0;padding:7px 10px;font-size:10px;line-height:1.65;">
            <strong style="color:var(--teal);">Finance Portal — Overdue Invoices screen:</strong> Each overdue INV shows a chase history thread (all ChaseNotes for that triplet, newest first). FD logs a new note inline: who was contacted, method, what was said, optional next chase date. nextChaseDate surfaces as a "follow up due" badge on the invoice row.
          </div>
          <div style="background:#F8FAFF;border:1px solid var(--mid);border-left:3px solid var(--blue);border-radius:0 3px 3px 0;padding:7px 10px;font-size:10px;line-height:1.65;">
            <strong style="color:var(--navy);">V2 — AI collections forward-compatibility:</strong> When AI drafting is added (Phase 2), ChaseNote gains <code>draftSource</code> (MANUAL · AI_HAIKU) and <code>outcome</code> (PAID · PROMISED · NO_RESPONSE · DISPUTED). These feed Claude Haiku's context for future drafts and the client payment reliability score. Design the entity now so V2 is a field addition, not a rebuild.
          </div>
        </div>
      </div>
    </div>
    <div class="entity-rel">InvoiceTriplet (1) → many ChaseNotes. Append-only — notes are never edited or deleted. contactedName and contactedEmail pre-populated from client FINANCE contact but editable per chase action.</div>
  </div>

  <!-- MANUAL CREDIT NOTE ENTITY -->
  <div class="mono-label" style="margin-top:8px;">ManualCreditNote entity — FD-raised credit notes</div>
  <div style="border-radius:5px;overflow:hidden;border:1.5px solid var(--mid);margin-bottom:24px;">
    <div class="entity-head" style="background:var(--navy);">ManualCreditNote <div class="badge">FD CREDIT NOTE</div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;">
      <div class="entity-body" style="border-right:1px solid var(--mid);">
        <div class="field-row"><span class="field-name field-pk">id</span><span class="field-type">UUID</span><span class="field-note">Primary key</span></div>
        <div class="field-row"><span class="field-name field-fk">invoiceTripletId</span><span class="field-type">FK → InvoiceTriplet</span><span class="field-note">The triplet being credited</span></div>
        <div class="field-row"><span class="field-name field-fk">agencyId</span><span class="field-type">FK → Agency</span><span class="field-note">Multi-tenancy enforcement</span></div>
        <div class="field-row"><span class="field-name field-fk">createdByUserId</span><span class="field-type">FK → User</span><span class="field-note">Finance Portal user who raised the CN</span></div>
        <div class="field-row"><span class="field-name">cnNumber</span><span class="field-type">String</span><span class="field-note">MCN-XXXX — sequential, distinct from system CN numbers</span></div>
        <div class="field-row"><span class="field-name">cnDate</span><span class="field-type">Date</span><span class="field-note">Date the CN is dated — defaults to today, editable</span></div>
        <div class="field-row"><span class="field-name">amount</span><span class="field-type">Decimal</span><span class="field-note">Credit amount — can be full or partial. Cannot exceed original triplet.grossAmount.</span></div>
        <div class="field-row"><span class="field-name">reason</span><span class="field-type">Text</span><span class="field-note">Required free-text reason — appears on CN PDF and Xero note</span></div>
        <div class="field-row"><span class="field-name">requiresReplacement</span><span class="field-type">Boolean</span><span class="field-note">If true: original milestone marked CANCELLED, agent notified to create replacement milestone on the same deal</span></div>
        <div class="field-row"><span class="field-name field-fk">replacementMilestoneId</span><span class="field-type">FK → Milestone?</span><span class="field-note">Null until agent creates the replacement. Linked when agent creates new milestone on deal.</span></div>
        <div class="field-row"><span class="field-name">xeroCnId</span><span class="field-type">String?</span><span class="field-note">Xero CreditNoteID after push</span></div>
        <div class="field-row"><span class="field-name">createdAt</span><span class="field-type">DateTime</span><span class="field-note">Auto-set on creation</span></div>
      </div>
      <div style="padding:14px 16px;background:white;font-size:11px;color:var(--slate);line-height:1.85;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:var(--grey);letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">Workflow behaviour</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <div style="background:#F8FAFF;border:1px solid var(--mid);border-left:3px solid var(--teal);border-radius:0 3px 3px 0;padding:7px 10px;font-size:10px;line-height:1.65;">
            <strong style="color:var(--teal);">Finance Portal — raising a CN:</strong> FD opens any approved triplet from the Invoice Queue or Overdue screen. "Raise Credit Note" action opens a drawer: pre-filled amount (full), editable to partial, reason field (required), requiresReplacement toggle, cnDate (defaults today). On confirm → CN PDF generated → pushed to Xero → Xero CreditNoteID stored.
          </div>
          <div style="background:#F8FAFF;border:1px solid var(--mid);border-left:3px solid var(--amber);border-radius:0 3px 3px 0;padding:7px 10px;font-size:10px;line-height:1.65;">
            <strong style="color:var(--amber);">If requiresReplacement = true:</strong> Original milestone status → CANCELLED (cancelledByTripletId set). Agent receives in-app notification: "Credit note MCN-XXXX raised against [deal title] — [milestone description]. A replacement invoice is required. Please add a new milestone to this deal." Deal card in Agency Portal shows an amber "Replacement required" badge until replacementMilestoneId is populated.
          </div>
          <div style="background:#F8FAFF;border:1px solid var(--mid);border-left:3px solid var(--blue);border-radius:0 3px 3px 0;padding:7px 10px;font-size:10px;line-height:1.65;">
            <strong style="color:var(--navy);">Replacement milestone:</strong> Agent creates a new milestone on the same deal. On save, system prompts: "Is this a replacement for a cancelled milestone?" If yes → new milestone.replacedCancelledMilestoneId set + ManualCreditNote.replacementMilestoneId linked. Amber badge clears from deal card. New milestone follows the standard completion → triplet → FD approval flow.
          </div>
        </div>
      </div>
    </div>
    <div class="entity-rel">InvoiceTriplet (1) → max one ManualCreditNote. ManualCreditNote is distinct from the system ON_BEHALF CN — different number series (MCN-XXXX vs CN-XXXX), different Xero endpoint treatment, always requires a reason. requiresReplacement drives the replacement milestone workflow.</div>
  </div>

  <!-- DEAL EXPENSE ENTITY -->
  <div class="mono-label" style="margin-top:8px;">DealExpense entity — rechargeable and non-rechargeable deal costs</div>
  <div style="border-radius:5px;overflow:hidden;border:1.5px solid var(--mid);margin-bottom:24px;">
    <div class="entity-head" style="background:var(--navy);">DealExpense <div class="badge">EXPENSE RECORD</div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;">
      <div class="entity-body" style="border-right:1px solid var(--mid);">
        <div class="field-row"><span class="field-name field-pk">id</span><span class="field-type">UUID</span><span class="field-note">Primary key</span></div>
        <div class="field-row"><span class="field-name field-fk">agencyId</span><span class="field-type">FK → Agency</span><span class="field-note">Multi-tenancy scope</span></div>
        <div class="field-row"><span class="field-name field-fk">dealId</span><span class="field-type">FK → Deal</span><span class="field-note">Required — expense belongs to a deal</span></div>
        <div class="field-row"><span class="field-name field-fk">milestoneId</span><span class="field-type">FK → Milestone?</span><span class="field-note">Optional — pin to milestone for INV inclusion. Null = deal-level, included on next milestone INV.</span></div>
        <div class="field-row"><span class="field-name">description</span><span class="field-type">String</span><span class="field-note">Free text. Appears as INV line item label if rechargeable.</span></div>
        <div class="field-row"><span class="field-name">category</span><span class="field-type">Enum</span><span class="field-note">TRAVEL · ACCOMMODATION · PRODUCTION · USAGE_RIGHTS · TALENT_FEE_UPLIFT · OTHER</span></div>
        <div class="field-row"><span class="field-name">amount</span><span class="field-type">Decimal</span><span class="field-note">Net amount ex-VAT</span></div>
        <div class="field-row"><span class="field-name">currency</span><span class="field-type">String</span><span class="field-note">Inherits deal currency. Stored explicitly.</span></div>
        <div class="field-row"><span class="field-name">vatApplicable</span><span class="field-type">Boolean</span><span class="field-note">If true: 20% VAT added on rechargeable INV line</span></div>
        <div class="field-row"><span class="field-name">incurredBy</span><span class="field-type">Enum</span><span class="field-note">AGENCY · TALENT — determines payout and Xero routing</span></div>
        <div style="margin:6px 0 4px;padding:4px 8px;background:#EEF2FA;border-radius:3px;font-family:'IBM Plex Mono',monospace;font-size:9px;color:var(--navy);">Control flags</div>
        <div class="field-row"><span class="field-name">rechargeable</span><span class="field-type">Boolean</span><span class="field-note">true → inject as INV line item on milestone invoice. false → internal cost only.</span></div>
        <div class="field-row"><span class="field-name">contractSignOff</span><span class="field-type">Boolean</span><span class="field-note">true → pre-approved in signed contract. false → triggers amber warning on INV approval in Finance Portal.</span></div>
        <div class="field-row"><span class="field-name">status</span><span class="field-type">Enum</span><span class="field-note">PENDING · APPROVED · INVOICED · EXCLUDED</span></div>
        <div class="field-row"><span class="field-name field-fk">approvedById</span><span class="field-type">FK → User?</span><span class="field-note">Finance Portal user. Cannot equal createdById.</span></div>
        <div class="field-row"><span class="field-name">approvedAt</span><span class="field-type">DateTime?</span></div>
        <div class="field-row"><span class="field-name">receiptUrl</span><span class="field-type">String?</span><span class="field-note">Uploaded receipt or supplier invoice PDF</span></div>
        <div class="field-row"><span class="field-name">supplierRef</span><span class="field-type">String?</span><span class="field-note">External supplier invoice number</span></div>
        <div class="field-row"><span class="field-name">notes</span><span class="field-type">String?</span><span class="field-note">Internal finance note</span></div>
        <div class="field-row"><span class="field-name">invoiceLineRef</span><span class="field-type">String?</span><span class="field-note">Xero INV line item ID — set on push</span></div>
        <div class="field-row"><span class="field-name field-fk">invoicedOnInvId</span><span class="field-type">FK → InvoiceTriplet?</span><span class="field-note">Set on INVOICED — prevents double-billing on subsequent INVs</span></div>
        <div class="field-row"><span class="field-name">createdAt</span><span class="field-type">DateTime</span></div>
      </div>
      <div style="padding:14px 16px;background:white;font-size:11px;color:var(--slate);line-height:1.85;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:var(--grey);letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">Flag combination behaviour</div>
        <div style="display:flex;flex-direction:column;gap:7px;">
          <div style="background:#F8FAFF;border:1px solid var(--mid);border-left:3px solid var(--green);border-radius:0 3px 3px 0;padding:7px 10px;font-size:10px;line-height:1.65;">
            <strong style="color:var(--green);">rechargeable=true · contractSignOff=true</strong><br>Added to INV line items. VAT per vatApplicable. Clean Finance Portal approval — no warning.
          </div>
          <div style="background:var(--amber-bg);border:1px solid var(--amber);border-left:3px solid var(--amber);border-radius:0 3px 3px 0;padding:7px 10px;font-size:10px;line-height:1.65;">
            <strong style="color:var(--amber);">rechargeable=true · contractSignOff=false</strong><br>Added to INV but INV approval held with amber warning: "X rechargeable expense(s) not pre-approved in contract." FD must confirm override (logged with userId + timestamp) before dispatch.
          </div>
          <div style="background:#F8FAFF;border:1px solid var(--mid);border-left:3px solid var(--grey);border-radius:0 3px 3px 0;padding:7px 10px;font-size:10px;line-height:1.65;">
            <strong style="color:var(--grey);">rechargeable=false · incurredBy=TALENT</strong><br>Not on INV. Deducted from net payout. Itemised on remittance statement. Guard: net payout cannot go below zero.
          </div>
          <div style="background:#F8FAFF;border:1px solid var(--mid);border-left:3px solid var(--grey);border-radius:0 3px 3px 0;padding:7px 10px;font-size:10px;line-height:1.65;">
            <strong style="color:var(--grey);">rechargeable=false · incurredBy=AGENCY</strong><br>Not on INV. Not on payout. Visible in Finance Portal deal margin view only — reduces agency net margin on deal.
          </div>
        </div>
        <div style="margin-top:12px;padding:8px 10px;background:var(--amber-bg);border:1px solid var(--amber);border-radius:3px;font-size:10px;color:var(--slate);line-height:1.65;">
          <strong style="color:var(--amber);">Invoice generation guard:</strong> Only APPROVED expenses are included in INV construction. PENDING expenses surface as a Finance Portal warning before INV approval: "X pending expenses on this milestone — approve or exclude before sending invoice."
        </div>
        <div style="margin-top:8px;padding:8px 10px;background:var(--red-bg);border:1px solid var(--red);border-radius:3px;font-size:10px;color:var(--slate);line-height:1.65;">
          <strong style="color:var(--red);">Payout floor guard:</strong> If talent expense deductions exceed (grossAmount − commission), throw PayoutValidationError. Finance Portal blocks payout run with error. Do not allow negative net payouts.
        </div>
        <div style="margin-top:8px;padding:8px 10px;background:#F8FAFF;border:1px solid var(--mid);border-radius:3px;font-size:10px;color:var(--slate);line-height:1.65;">
          <strong style="color:var(--navy);">Post-INV edge case:</strong> If an expense is created after the milestone INV has already been pushed to Xero, it cannot be added to that INV. Finance Portal shows a warning and queues it for the next available milestone INV, or FD can trigger a standalone Supplementary Expense Invoice (SEI) if the deal is complete.
        </div>
      </div>
    </div>
    <div class="entity-rel">Deal (1) → many DealExpenses. Milestone (1) → many DealExpenses (where milestoneId set). InvoiceTriplet (1) → many DealExpenses (where invoicedOnInvId set, status=INVOICED). Self-approval prohibited — approvedById cannot equal createdById. Xero: rechargeable expenses → INV line item (Rechargeable Expenses account code); agency-incurred non-rechargeable with receipt → ACCPAY bill; talent-absorbed non-rechargeable → payout deduction only, no Xero document.</div>
  </div>

  <!-- RELATIONSHIPS -->

  <div class="callout callout-navy" style="margin-bottom:0;">
    <strong style="color:var(--navy);">Key relationship rules:</strong>
    Agency (1) → many Clients, Talents, Deals &nbsp;·&nbsp;
    Client (1) → many ClientContacts (min 1 PRIMARY required) &nbsp;·&nbsp;
    Deal (1) → many Milestones. INV due date = triplet.invoiceDate + (deal.paymentTermsDays ?? client.paymentTermsDays) &nbsp;·&nbsp;
    Milestone (1) → one InvoiceTriplet (unless CANCELLED). invoiceDate is the tax point — set by agent, editable by FD before push &nbsp;·&nbsp;
    InvoiceTriplet (1) → many ChaseNotes · max one ManualCreditNote. All monetary fields immutable after generation &nbsp;·&nbsp;
    ManualCreditNote.requiresReplacement = true → Milestone.status = CANCELLED → agent creates replacement Milestone on same Deal &nbsp;·&nbsp;
    Deal (1) → many DealExpenses. rechargeable=true + APPROVED → injected into INV line items at generation. rechargeable=false + TALENT → deducted from net payout. invoicedOnInvId set on INVOICED — prevents double-billing &nbsp;·&nbsp;
    INV "Attention:" field = Client's FINANCE contact name, fallback to PRIMARY &nbsp;·&nbsp;
    VAT monitor uses triplet.invoiceDate as date-of-supply basis &nbsp;·&nbsp;
    All entities are scoped to agencyId — no cross-agency data access ever
  </div>

</div>


<!-- ═══ SECTION 4: INVOICE ENGINE ═══ -->
<div class="section-divider" style="background:#1A244E;">
  <div class="sd-num">04</div>
  <div class="sd-titles">
    <h2>Invoice Engine — Two Invoicing Models</h2>
    <p>Self-Billing (INV/SBI/COM) and On Behalf (OBI/CN/COM) — logic, VAT rules, and Xero mapping for both</p>
  </div>
  <div class="sd-badge" style="background:rgba(30,85,204,0.3);color:#93C5FD;border:1px solid rgba(30,85,204,0.5);">CRITICAL LOGIC</div>
</div>

<div class="section">

  <!-- MODEL COMPARISON -->
  <div class="mono-label">The two invoicing models — what they are and when each applies</div>
  <div class="two-col" style="margin-bottom:24px;">
    <div style="border-radius:5px;overflow:hidden;border:2px solid var(--blue);">
      <div style="background:var(--blue);color:white;padding:10px 16px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;opacity:0.7;letter-spacing:1px;text-transform:uppercase;margin-bottom:3px;">Model A · agency.invoicingModel = SELF_BILLING</div>
        <div style="font-size:14px;font-weight:700;">Standard Self-Billing</div>
      </div>
      <div style="padding:14px 16px;background:white;font-size:11px;color:var(--slate);line-height:1.85;">
        <strong style="color:var(--navy);">How it works:</strong> The agency acts as principal. The agency invoices the client in its own name (INV). Separately, the agency raises a self-billing invoice on the talent's behalf (SBI) — this is the agency's cost of sale. A commission invoice (COM) is then raised to talent representing the agency's net revenue. Three documents, agency is the named seller on the client invoice.
        <br><br>
        <strong style="color:var(--navy);">VAT on INV:</strong> Depends on agency.vatRegistered<br>
        <strong style="color:var(--navy);">VAT on SBI:</strong> Depends on talent.vatRegistered<br>
        <strong style="color:var(--navy);">VAT on COM:</strong> Depends on agency.vatRegistered
      </div>
    </div>
    <div style="border-radius:5px;overflow:hidden;border:2px solid var(--amber);">
      <div style="background:var(--amber);color:white;padding:10px 16px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;opacity:0.7;letter-spacing:1px;text-transform:uppercase;margin-bottom:3px;">Model B · agency.invoicingModel = ON_BEHALF</div>
        <div style="font-size:14px;font-weight:700;">On Behalf of Talent</div>
      </div>
      <div style="padding:14px 16px;background:white;font-size:11px;color:var(--slate);line-height:1.85;">
        <strong style="color:var(--navy);">How it works:</strong> The agency acts as agent. The agency raises an invoice to the client on behalf of the talent — talent is the named supplier on the invoice (OBI). Because the gross flows through the agency's books but is not agency revenue, a credit note (CN) is raised in Xero to zero off the OBI amount. The commission invoice (COM) is then raised — this is the only line representing agency revenue. Two documents visible to the client (OBI + CN in Xero), one representing agency revenue (COM).
        <br><br>
        <strong style="color:var(--navy);">VAT on OBI:</strong> Depends on <strong>talent.vatRegistered</strong> (talent's VAT number on invoice, not agency's)<br>
        <strong style="color:var(--navy);">VAT on CN:</strong> Mirrors OBI VAT treatment exactly<br>
        <strong style="color:var(--navy);">VAT on COM:</strong> Depends on agency.vatRegistered
      </div>
    </div>
  </div>

  <div class="callout callout-amber">
    <strong style="color:var(--amber);">Key VAT distinction for ON_BEHALF:</strong> In Model B, the OBI is effectively the <em>talent's</em> invoice raised by the agency as their agent. If the talent is VAT registered, their VAT number (not the agency's) must appear on the OBI, and the client can reclaim the input VAT. If the talent is not VAT registered, no VAT is charged on the OBI at all — the agency's VAT registration is irrelevant for this document. The agency's VAT registration only governs the COM invoice. This is a legally meaningful distinction and the invoice PDF template must reflect it correctly.
  </div>

  <!-- CALCULATION RULES -->
  <div class="mono-label">Model A — Self-Billing calculation: £12,000 deal, 20% commission, agency VAT registered, talent not VAT registered</div>
  <div class="code-block">
    <div class="c-comment">// Inputs from Milestone + Deal</div>
    <div><span class="c-key">grossAmount</span>      = milestone.grossAmount         <span class="c-comment">// £12,000 — the full deal fee billed to client</span></div>
    <div><span class="c-key">commissionRate</span>   = deal.commissionRate            <span class="c-comment">// 0.20 (20%) — snapshot stored on triplet at generation</span></div>
    <div><span class="c-key">paymentTermsDays</span> = deal.paymentTermsDays ?? client.paymentTermsDays  <span class="c-comment">// e.g. 30 days</span></div>
    <div><span class="c-key">issuedAt</span>         = triplet.issuedAt               <span class="c-comment">// Set on Finance Portal approval — the invoice date</span></div>
    <div><span class="c-key">invDueDate</span>       = issuedAt + paymentTermsDays    <span class="c-comment">// e.g. approved 1 Apr → due 1 May (30-day terms)</span></div>
    <div style="height:8px;"></div>
    <div class="c-comment">// INV — Client Invoice (Agency → Client) — agency is named seller</div>
    <div><span class="c-key">inv.net</span>          = grossAmount                   <span class="c-comment">// £12,000</span></div>
    <div><span class="c-key">inv.vat</span>          = agency.vatRegistered ? grossAmount × 0.20 : 0  <span class="c-comment">// £2,400 (agency VAT registered)</span></div>
    <div><span class="c-key">inv.gross</span>        = inv.net + inv.vat             <span class="c-comment">// £14,400 total client pays</span></div>
    <div style="height:8px;"></div>
    <div class="c-comment">// SBI — Self-Billing Invoice (Agency raises on Talent's behalf → Talent)</div>
    <div><span class="c-key">sbi.net</span>          = grossAmount                   <span class="c-comment">// £12,000 — full gross, pre-commission deduction</span></div>
    <div><span class="c-key">sbi.vat</span>          = talent.vatRegistered ? grossAmount × 0.20 : 0  <span class="c-comment">// £0 (talent not VAT registered)</span></div>
    <div><span class="c-key">sbi.gross</span>        = sbi.net + sbi.vat             <span class="c-comment">// £12,000 — Xero ACCPAY, agency's cost of sale</span></div>
    <div style="height:8px;"></div>
    <div class="c-comment">// COM — Commission Invoice (Agency → Talent — deducted at payout)</div>
    <div><span class="c-key">com.net</span>          = grossAmount × commissionRate  <span class="c-comment">// £2,400 — agency's earned commission</span></div>
    <div><span class="c-key">com.vat</span>          = agency.vatRegistered ? com.net × 0.20 : 0  <span class="c-comment">// £480</span></div>
    <div><span class="c-key">com.gross</span>        = com.net + com.vat             <span class="c-comment">// £2,880</span></div>
    <div style="height:8px;"></div>
    <div class="c-comment">// Net payout to talent</div>
    <div><span class="c-key">netPayout</span>        = sbi.net − com.net             <span class="c-comment">// £12,000 − £2,400 = £9,600 (ex-VAT transfer amount)</span></div>
  </div>

  <div class="mono-label" style="margin-top:4px;">Model B — On Behalf calculation: same deal, talent not VAT registered</div>
  <div class="code-block">
    <div class="c-comment">// Inputs — same grossAmount, commissionRate, paymentTermsDays, issuedAt as Model A</div>
    <div style="height:8px;"></div>
    <div class="c-comment">// OBI — On Behalf Invoice (Agency raises on Talent's behalf → Client)</div>
    <div class="c-comment">// Talent is the named supplier on this document. Agency acts as billing agent.</div>
    <div><span class="c-key">obi.net</span>          = grossAmount                   <span class="c-comment">// £12,000</span></div>
    <div><span class="c-key">obi.vat</span>          = talent.vatRegistered ? grossAmount × 0.20 : 0  <span class="c-comment">// £0 (talent not VAT registered)</span></div>
    <div><span class="c-key">obi.gross</span>        = obi.net + obi.vat             <span class="c-comment">// £12,000 client pays (no VAT — talent unregistered)</span></div>
    <div class="c-warn">// OBI uses talent.vatNumber (not agency.vatNumber) if talent is VAT registered</div>
    <div style="height:8px;"></div>
    <div class="c-comment">// CN — Credit Note (raised against OBI to zero off gross in agency's Xero books)</div>
    <div class="c-comment">// The gross amount is NOT agency revenue — it flows through to talent.</div>
    <div><span class="c-key">cn.net</span>           = grossAmount                   <span class="c-comment">// £12,000 — exactly mirrors OBI</span></div>
    <div><span class="c-key">cn.vat</span>           = obi.vat                       <span class="c-comment">// £0 — mirrors OBI VAT exactly</span></div>
    <div><span class="c-key">cn.gross</span>         = cn.net + cn.vat               <span class="c-comment">// £12,000 — net effect on agency P&L = £0</span></div>
    <div style="height:8px;"></div>
    <div class="c-comment">// COM — Commission Invoice (Agency → Talent) — identical to Model A</div>
    <div><span class="c-key">com.net</span>          = grossAmount × commissionRate  <span class="c-comment">// £2,400 — agency's only revenue line</span></div>
    <div><span class="c-key">com.vat</span>          = agency.vatRegistered ? com.net × 0.20 : 0  <span class="c-comment">// £480 (agency VAT registered)</span></div>
    <div><span class="c-key">com.gross</span>        = com.net + com.vat             <span class="c-comment">// £2,880</span></div>
    <div style="height:8px;"></div>
    <div class="c-comment">// Net payout to talent — identical calculation to Model A</div>
    <div><span class="c-key">netPayout</span>        = obi.net − com.net             <span class="c-comment">// £12,000 − £2,400 = £9,600 (ex-VAT transfer amount)</span></div>
    <div class="c-warn">// Note: CN does NOT affect netPayout — it's an internal Xero accounting entry only</div>
  </div>

  <!-- XERO MAPPING TABLE -->
  <div class="mono-label">Xero account code mapping — both models</div>
  <table class="spec" style="margin-bottom:24px;">
    <thead>
      <tr><th>Model</th><th>Document</th><th>Direction</th><th>Xero Type</th><th>Suggested Account Code</th><th>Contact in Xero</th><th>VAT / Tax Type</th></tr>
    </thead>
    <tbody>
      <tr>
        <td rowspan="3" style="background:#EEF2FA;font-weight:700;color:var(--blue);vertical-align:middle;text-align:center;">SELF_BILLING</td>
        <td>INV — Client Invoice</td>
        <td>Agency → Client</td>
        <td>ACCREC</td>
        <td>200 — Sales / Gross Revenue <em>(configurable)</em></td>
        <td>Client (IsCustomer=true)</td>
        <td>OUTPUT2 if agency VAT registered · NONE if not</td>
      </tr>
      <tr>
        <td>SBI — Self-Billing Invoice</td>
        <td>Agency → Talent (on talent's behalf)</td>
        <td>ACCPAY (Bill)</td>
        <td>300 — Talent Costs / COGS <em>(configurable)</em></td>
        <td>Talent (IsSupplier=true)</td>
        <td>INPUT2 if talent VAT registered · NONE if not</td>
      </tr>
      <tr>
        <td>COM — Commission Invoice</td>
        <td>Agency → Talent</td>
        <td>ACCREC</td>
        <td>400 — Commission Income <em>(configurable)</em></td>
        <td>Talent (IsSupplier=true)</td>
        <td>OUTPUT2 if agency VAT registered · NONE if not</td>
      </tr>
      <tr style="border-top:2px solid var(--amber);">
        <td rowspan="3" style="background:#FEF3C7;font-weight:700;color:var(--amber);vertical-align:middle;text-align:center;">ON_BEHALF</td>
        <td>OBI — On Behalf Invoice</td>
        <td>Agency (as agent) → Client<br><em>Talent named as supplier</em></td>
        <td>ACCREC</td>
        <td>500 — On Behalf Billing (transitory — net zero) <em>(configurable)</em></td>
        <td>Client (IsCustomer=true). Talent name + VAT number in invoice body if talent VAT registered.</td>
        <td>OUTPUT2 if <strong>talent</strong> VAT registered · NONE if not. Talent's VAT number on invoice, not agency's.</td>
      </tr>
      <tr>
        <td>CN — Credit Note</td>
        <td>Internal Xero entry — zeroes OBI off agency P&amp;L</td>
        <td>ACCREC Credit Note</td>
        <td>500 — On Behalf Billing (same account as OBI — net effect = £0) <em>(configurable)</em></td>
        <td>Client (IsCustomer=true). Mirrors OBI exactly.</td>
        <td>Mirrors OBI VAT treatment exactly — same tax type and amount as OBI.</td>
      </tr>
      <tr>
        <td>COM — Commission Invoice</td>
        <td>Agency → Talent</td>
        <td>ACCREC</td>
        <td>400 — Commission Income <em>(same as SELF_BILLING)</em></td>
        <td>Talent (IsSupplier=true)</td>
        <td>OUTPUT2 if agency VAT registered · NONE if not</td>
      </tr>
    </tbody>
  </table>
  <div style="font-size:11px;color:var(--grey);margin-bottom:24px;font-style:italic;">Account codes are suggestions only and must be configurable per agency. The ON_BEHALF transitory account (suggested 500) should be a dedicated Xero account so the OBI/CN net-zero pair is clearly identifiable in the agency's chart of accounts. Do not map it to the Sales account.</div>

  <!-- APPROVAL FLOW -->
  <div class="mono-label">Invoice generation and approval flow</div>
  <div style="background:#F8FAFF;border:1.5px solid var(--mid);border-radius:6px;padding:24px;overflow-x:auto;margin-bottom:24px;">
    <div class="flow">
      <div class="node"><div class="node-box n-blue">Milestone Marked<br>Complete<div class="node-sub">Agent action in Agency Portal</div></div><div class="node-label">Triggers triplet generation</div></div>
      <div class="arrow"><div class="line"></div><div class="head"></div></div>
      <div class="node"><div class="node-box n-blue2">InvoiceTriplet<br>Created<div class="node-sub">SELF_BILLING: INV+SBI+COM<br>ON_BEHALF: OBI+CN+COM<br>PDFs generated · status: PENDING</div></div><div class="node-label">Model determined by agency.invoicingModel</div></div>
      <div class="arrow"><div class="line"></div><div class="head"></div></div>
      <div class="node"><div class="node-box n-teal">Finance Portal<br>Queue<div class="node-sub">FD reviews triplet<br>Sees all three amounts</div></div><div class="node-label">Approval required before push</div></div>
      <div class="arrow"><div class="line"></div><div class="head"></div></div>
      <div class="node"><div class="node-box n-teal2">FD Approves<br>(or Rejects)<div class="node-sub">Reject → note required<br>→ back to agent</div></div><div class="node-label">approvalStatus updated</div></div>
      <div class="arrow"><div class="line"></div><div class="head"></div></div>
      <div class="node"><div class="node-box n-navy">Push to Xero<div class="node-sub">SELF_BILLING: ACCREC(INV+COM) + ACCPAY(SBI)<br>ON_BEHALF: ACCREC(OBI+CN+COM)<br>All Xero IDs stored</div></div><div class="node-label">3 API calls, one transaction — all or nothing</div></div>
      <div class="arrow"><div class="line"></div><div class="head"></div></div>
      <div class="node"><div class="node-box n-green">Xero Webhook<br>INV Paid<div class="node-sub">milestone.status → PAID<br>payoutStatus → READY</div></div><div class="node-label">Client pays in Xero, portal auto-updates</div></div>
    </div>
  </div>

  <!-- EDGE CASES -->
  <div class="mono-label">Edge cases — build must handle these</div>
  <table class="spec">
    <thead><tr><th>Scenario</th><th>Expected Behaviour</th></tr></thead>
    <tbody>
      <tr><td>Talent not VAT registered</td><td>SBI raised with no VAT (NONE tax type in Xero). sbi.vat = 0. VAT monitor tracks SBI net amounts against talent threshold.</td></tr>
      <tr><td>Talent VAT registered</td><td>SBI raised with 20% VAT. VAT monitor suppressed for this talent (vatRegistered = true). Agency can reclaim input VAT on SBI in their return.</td></tr>
      <tr><td>Commission rate = 0%</td><td>COM generated with com.net = £0, com.vat = £0. Still pushed to Xero as a £0 record for audit trail. netPayout = grossAmount.</td></tr>
      <tr><td>FD rejects triplet</td><td>approvalStatus = REJECTED. Rejection note stored. Agent notified. Agent can edit deal/milestone data and re-trigger generation. Original triplet voided, new one created.</td></tr>
      <tr><td>Xero push fails (API error)</td><td>Retry logic: 3 attempts with exponential backoff. If all fail: Finance Portal shows error banner with error details. Triplet status = XERO_PUSH_FAILED. Manual retry button available. No partial pushes — all three or none (transactional).</td></tr>
      <tr><td>INV partially paid in Xero</td><td>Partial payment webhook fires. Milestone status remains INVOICED (not PAID) until INV fully paid. Payout not available until full payment received.</td></tr>
      <tr><td>Multiple milestones on one deal</td><td>Each milestone has its own InvoiceTriplet. Payout state is per milestone. Milestone 1 can be at PAYOUT_READY while Milestone 2 is still PENDING. No deal-level aggregation of payout state.</td></tr>
      <tr>
        <td colspan="2" style="background:var(--amber-bg);color:var(--amber);font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:1px;text-transform:uppercase;padding:5px 12px;">ON_BEHALF model edge cases</td>
      </tr>
      <tr><td>Talent VAT registered — ON_BEHALF</td><td>OBI includes VAT at 20%. Talent's VAT number (not agency's) must appear on the OBI PDF. CN mirrors OBI VAT exactly. Agency reclaims nothing — the VAT on OBI is the talent's liability to HMRC, not the agency's.</td></tr>
      <tr><td>Talent not VAT registered — ON_BEHALF</td><td>OBI raised with no VAT (NONE tax type). CN mirrors with no VAT. VAT monitor tracks OBI gross amounts against talent threshold exactly as it does SBI in Model A.</td></tr>
      <tr><td>CN must mirror OBI exactly</td><td>CN amount, VAT type, and account code must be identical to the OBI it cancels. No partial credit notes. If OBI is for £12,000 + no VAT, CN is for £12,000 + no VAT. The pair must net to exactly £0 in Xero.</td></tr>
      <tr><td>Changing invoicingModel after deals exist</td><td>System must warn strongly: "You have [N] existing deals with generated invoices. Changing your invoicing model will not affect historical triplets but all future triplets will use the new model. This may cause inconsistency in your Xero accounts. Are you sure?" Require typed confirmation. Log the change with timestamp.</td></tr>
      <tr><td>OBI paid but payout not yet confirmed (ON_BEHALF)</td><td>Xero webhook fires, milestone → PAID, payoutStatus → READY. CN remains unallocated. COM remains outstanding. This is correct — settlement only fires on payout confirmation, not on OBI payment. Finance Portal Payout Centre shows the milestone as ready. No Xero action taken at this stage.</td></tr>
      <tr>
        <td colspan="2" style="background:var(--navy);color:#93C5FD;font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:1px;text-transform:uppercase;padding:5px 12px;">Invoice date amendment edge cases</td>
      </tr>
      <tr><td>FD amends invoice date before Xero push</td><td>invoiceDate on InvoiceTriplet is updated. PDF regenerated with the new date. INV due date recalculated as new invoiceDate + invDueDateDays. No Xero call needed — invoice not yet pushed. Permitted at any point while approvalStatus = PENDING.</td></tr>
      <tr><td>FD wants to amend invoice date after Xero push (AUTHORISED)</td><td>Xero allows updates to AUTHORISED (unpaid) invoices. Therum calls PUT /Invoices/{InvoiceID} with the new date. triplet.invoiceDate updated to match. PDF regenerated. Log the amendment with old date, new date, and userId. Not permitted once invPaidAt is set — Xero does not allow edits on PAID invoices.</td></tr>
      <tr><td>FD wants to amend invoice date after invoice is PAID in Xero</td><td>Not permitted — blocked in UI with explanation: "This invoice has been marked as paid in Xero and cannot be amended. Raise a credit note and replacement invoice if a correction is required."</td></tr>
      <tr>
        <td colspan="2" style="background:var(--navy);color:#93C5FD;font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:1px;text-transform:uppercase;padding:5px 12px;">Manual credit note edge cases</td>
      </tr>
      <tr><td>Partial CN raised</td><td>ManualCreditNote.amount &lt; triplet.grossAmount. CN PDF and Xero credit note raised for partial amount only. Original triplet remains active — it is not cancelled. requiresReplacement toggle should default to false for partial CNs (but FD can override). VAT monitor: if CN is partial, the credited portion is not deducted from the rolling SBI total in MVP — flag as a known limitation to address post-beta.</td></tr>
      <tr><td>Full CN raised with requiresReplacement = true</td><td>Original milestone → CANCELLED. cancelledByTripletId set. Agent receives in-app notification. Deal card shows amber "Replacement invoice required" badge. Agent creates new milestone on same deal → prompted to link as replacement → ManualCreditNote.replacementMilestoneId populated → badge clears. New milestone follows standard flow.</td></tr>
      <tr><td>Full CN raised with requiresReplacement = false</td><td>Original milestone → CANCELLED. No agent notification. No replacement badge. Used when the deal is genuinely cancelled — not an amendment. Deal stage should be reviewed by agent (may need moving to a closed/cancelled stage — out of scope for MVP but worth noting in UI).</td></tr>
      <tr><td>CN raised against already-paid invoice</td><td>Permitted — this is the standard scenario (client has paid, error found, CN + reissue required). Therum raises the CN in Xero against the paid invoice. Xero will show a credit balance on the client account. FD applies the credit to the replacement invoice when it is issued. replacementMilestoneId workflow same as above.</td></tr>
    </tbody>
  </table>

</div>


<!-- ═══ SECTION 5: PORTALS ═══ -->
<div class="section-divider" style="background:#1A244E;">
  <div class="sd-num">05</div>
  <div class="sd-titles">
    <h2>Portal Specifications</h2>
    <p>Exact screens, navigation, and features for all three MVP portals</p>
  </div>
  <div class="sd-badge" style="background:rgba(30,85,204,0.3);color:#93C5FD;border:1px solid rgba(30,85,204,0.5);">UX REFERENCE</div>
</div>

<div class="section">

  <div class="portal-grid">

    <div class="portal-card" style="border-color:var(--blue);">
      <div class="portal-head" style="background:var(--navy);">
        <h3>Agency Portal</h3>
        <div class="role">Role: Agent / Account Manager</div>
      </div>
      <div class="portal-body">
        <div style="font-size:10px;font-family:'IBM Plex Mono',monospace;color:var(--grey);letter-spacing:0.5px;margin-bottom:10px;text-transform:uppercase;">Navigation & screens</div>
        <ul>
          <li><strong>Dashboard</strong> — active deals count, invoices awaiting approval, upcoming milestone due dates, VAT alerts summary</li>
          <li><strong>Deals (Kanban)</strong> — four-stage board. Drag-and-drop stage movement. Deal cards show talent name, client, total value, next milestone date.</li>
          <li><strong>Deals (Table)</strong> — sortable/filterable list view. Toggle from Kanban.</li>
          <li><strong>Deal Detail</strong> — full deal record. Milestone list with status chips (PENDING · COMPLETE · INVOICED · PAID · CANCELLED). Each milestone row shows: description, gross amount, <strong>Invoice Date</strong> (labelled explicitly as "Invoice Date" — not due date), optional Delivery Due Date if set, invoice triplet status, payout status. Cancelled milestones shown with a strikethrough style and "Cancelled — CN raised" label — not hidden, preserved for audit trail. If a replacement is pending, deal card shows an amber <strong>"Replacement invoice required"</strong> badge until the agent creates the replacement milestone. Notes field. Contract ref.</li>
          <li><strong>Clients (list)</strong> — all client brands. Each row shows name, outstanding INV total, and a contact count chip (e.g. "2 contacts"). Create new client from this screen.</li>
          <li><strong>Client Detail</strong> — full client record: name, payment terms, VAT number, notes. <strong>Contacts section</strong> lists all ClientContacts with name, email, role chip (PRIMARY / FINANCE / OTHER), phone, and Xero sync status. Add / edit / remove contacts inline. Validation: at least one PRIMARY must exist — system blocks removal of the last PRIMARY contact.</li>
          <li><strong>Talent</strong> — list + create/edit. VAT alert badge on talent card if threshold approaching. Portal invite toggle.</li>
          <li><strong>VAT Monitor</strong> — table of all talent with rolling 12-month SBI total, tier status (CLEAR / APPROACHING / IMMINENT / BREACHED), and projected breach date. Filterable by tier.</li>
        </ul>
        <div style="margin-top:12px;font-size:10px;color:var(--grey);font-style:italic;">Note: Agent cannot approve invoices or trigger Xero pushes — those actions are Finance Portal only.</div>
      </div>
    </div>

    <div class="portal-card" style="border-color:var(--teal);">
      <div class="portal-head" style="background:var(--teal);">
        <h3>Finance Portal</h3>
        <div class="role">Role: Finance Director / Bookkeeper</div>
      </div>
      <div class="portal-body">
        <div style="font-size:10px;font-family:'IBM Plex Mono',monospace;color:var(--grey);letter-spacing:0.5px;margin-bottom:10px;text-transform:uppercase;">Navigation & screens</div>
        <ul>
          <li><strong>Dashboard</strong> — invoices awaiting approval (count + total value), Xero connection status, overdue INV count, payout-ready milestones count</li>
          <li><strong>Invoice Queue</strong> — pending approval triplets. Each row: talent, client, deal, INV/SBI/COM amounts, invoice date, due date. Expand to see all three PDFs inline. <strong>Invoice date editable before approval</strong> — FD can correct the date set by the agent before pushing to Xero. Once approved and pushed, date is locked (Xero does not allow date edits on PAID invoices; AUTHORISED invoices can be voided and re-raised — see edge cases). Approve / Reject with notes.</li>
          <li><strong>Credit Notes</strong> — dedicated screen. List of all ManualCreditNotes raised, with status (PENDING · PUSHED · FAILED). "Raise Credit Note" button — available from this screen or inline from any approved triplet row. CN drawer: pre-filled full amount (editable to partial), reason (required), invoice date (defaults today, editable), "Requires replacement invoice" toggle. On confirm: CN PDF generated, pushed to Xero, original milestone marked CANCELLED if requiresReplacement=true, agent notified.</li>
          <li><strong>Xero Sync</strong> — connection status, last sync timestamp, failed push log, manual re-sync trigger. Account code mapping settings.</li>
          <li><strong>Overdue Invoices</strong> — INVs (SELF_BILLING) or OBIs (ON_BEHALF) past due date. Days overdue, amount, client, deal. Chase history thread per invoice. Add new chase note inline. "Raise Credit Note" also accessible from overdue invoice rows. COM invoices never shown for ON_BEHALF agencies.</li>
          <li><strong>Payout Centre</strong> — milestones where payoutStatus = READY. Shows talent name, deal, milestone, gross amount, commission deducted, net payout. "Confirm Payout" triggers payout summary PDF + Xero settlement (ON_BEHALF: CN allocation + COM marked PAID).</li>
          <li><strong>VAT Compliance</strong> — rolling VAT monitor data in finance context. SBI/OBI totals by period.</li>
          <li><strong>Settings</strong> — Xero OAuth, account code mapping, agency bank details, commission default, invoicing model (editable with strong warning if existing invoices present).</li>
        </ul>
      </div>
    </div>

    <div class="portal-card" style="border-color:var(--purple);">
      <div class="portal-head" style="background:var(--purple);">
        <h3>Talent Portal</h3>
        <div class="role">Role: Talent / Creator — model-aware rendering</div>
      </div>
      <div class="portal-body">
        <div style="font-size:10px;font-family:'IBM Plex Mono',monospace;color:var(--grey);letter-spacing:0.5px;margin-bottom:10px;text-transform:uppercase;">Screens present in both models</div>
        <ul>
          <li><strong>Dashboard</strong> — payouts ready (milestones at PAYOUT_READY with net amounts), active deals count, recent documents</li>
          <li><strong>My Deals</strong> — own deals only. Stage, client name, milestone status, gross amount, net payout amount. Read-only.</li>
          <li><strong>Earnings</strong> — all completed milestones. Gross deal fee, commission deducted, net payout received. Filterable by date range. Same in both models.</li>
          <li><strong>My Profile</strong> — name, email, commission rate (view only), VAT registration status.</li>
        </ul>

        <div style="margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div style="background:#EEF2FA;border:1.5px solid var(--blue);border-radius:4px;padding:10px 12px;font-size:10px;color:var(--slate);line-height:1.75;">
            <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;color:var(--blue);letter-spacing:0.5px;text-transform:uppercase;margin-bottom:6px;">SELF_BILLING — Documents screen</div>
            <strong style="color:var(--navy);">Remittances tab:</strong> Downloadable PDF remittance statements. One per payout run. Shows SBI reference, client name, gross amount, commission deducted, net amount paid.<br><br>
            <strong style="color:var(--navy);">Commission invoices tab:</strong> COM PDFs — one per milestone. Shows commission amount and VAT. Download only.<br><br>
            SBI is not shown to talent in this model — it is an internal agency accounting document, not a document the talent needs.
          </div>
          <div style="background:#FEF3C7;border:1.5px solid var(--amber);border-radius:4px;padding:10px 12px;font-size:10px;color:var(--slate);line-height:1.75;">
            <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;color:var(--amber);letter-spacing:0.5px;text-transform:uppercase;margin-bottom:6px;">ON_BEHALF — Documents screen</div>
            <strong style="color:var(--navy);">My Invoices tab:</strong> OBI PDFs — one per milestone. This is the talent's own invoice to the client, raised by the agency on their behalf. Talent can <strong>view and download</strong> each OBI. Label: "Invoice to [Client Name] · [OBI number] · [Date]". If talent is VAT registered, their VAT number appears on the document.<br><br>
            <strong style="color:var(--navy);">Commission invoices tab:</strong> COM PDFs — one per milestone. Shows commission amount deducted. Download only.<br><br>
            <strong style="color:var(--navy);">Remittances tab:</strong> Payout remittance statements as before — gross, commission deducted, net paid. References OBI number instead of SBI.<br><br>
            CN is never shown to talent — it is an internal Xero zeroing entry only.
          </div>
        </div>

        <div style="margin-top:12px;background:#F5F3FF;border:1px solid var(--purple);border-radius:4px;padding:10px 12px;font-size:10px;color:var(--slate);line-height:1.7;">
          <strong style="color:var(--purple);">PDF generation for ON_BEHALF:</strong> OBI PDFs are generated by Therum at the point the Finance Portal approves the triplet — the same moment the Xero push fires. The PDF is stored (Cloudflare R2) and immediately available in the Talent Portal. Talent does not trigger generation — it is ready when they log in. Download button on each OBI row produces the stored PDF directly. No re-generation on demand required, but a "re-download" button should always be present in case of browser issues.<br><br>
          <strong style="color:var(--purple);">Access control:</strong> Talent Portal scoped strictly to talentId. Talent can only see documents from their own deals. JWT scoped to talentId + agencyId.
        </div>
      </div>
    </div>

  </div>

  <!-- AUTH MODEL -->
  <div class="mono-label">Authentication & role model</div>
  <table class="spec">
    <thead><tr><th>Role</th><th>Portal Access</th><th>Auth Method</th><th>Permissions</th></tr></thead>
    <tbody>
      <tr><td>AGENCY_ADMIN</td><td>Agency Portal (full) + Finance Portal (full)</td><td>Email + password. MFA optional in MVP.</td><td>All actions across both portals. Can invite Finance users.</td></tr>
      <tr><td>AGENCY_AGENT</td><td>Agency Portal only</td><td>Email + password.</td><td>Deals, milestones, clients, talent records. Cannot approve invoices or trigger Xero push.</td></tr>
      <tr><td>FINANCE</td><td>Finance Portal only</td><td>Email + password.</td><td>Invoice approval, Xero sync, payout centre, overdue monitor. Cannot create or edit deals.</td></tr>
      <tr><td>TALENT</td><td>Talent Portal only</td><td>Magic link invite → password set.</td><td>Read-only. Own records only. Scoped to talentId.</td></tr>
    </tbody>
  </table>

  <!-- ONBOARDING / FIRST-RUN FLOW -->
  <div class="mono-label" style="margin-top:28px;">Agency onboarding — first-run flow</div>
  <div class="callout callout-navy" style="margin-bottom:16px;">
    <strong style="color:var(--navy);">How a beta tester gets an account:</strong> For MVP with 3–5 testers, Therum manually provisions Agency accounts — no self-serve signup page. Bhavik creates the agency record (planTier = BETA), creates the first AGENCY_ADMIN user, and triggers a password-set email. Self-serve signup is a post-beta feature.
  </div>
  <div style="display:flex;flex-direction:column;gap:0;border-radius:5px;overflow:hidden;border:1.5px solid var(--mid);margin-bottom:28px;">
    <div style="background:var(--navy);color:white;padding:8px 16px;font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;letter-spacing:0.5px;">Guided setup — shown to AGENCY_ADMIN on first login (4-step checklist)</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0;">
      <div style="padding:14px 16px;background:white;border-right:1px solid var(--mid);font-size:11px;color:var(--slate);line-height:1.8;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:var(--blue);font-weight:700;margin-bottom:6px;text-transform:uppercase;">Step 1 · Agency details</div>
        Confirm agency name and VAT registration status + number. These appear on all invoice PDFs. Then select invoicing model: <strong>Self-Billing</strong> (agency invoices in its own name) or <strong>On Behalf of Talent</strong> (agency invoices as billing agent, talent named as supplier). Tooltip explains the difference. Blocking — cannot generate invoices until vatRegistered and invoicingModel are set.
      </div>
      <div style="padding:14px 16px;background:white;border-right:1px solid var(--mid);font-size:11px;color:var(--slate);line-height:1.8;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:var(--teal);font-weight:700;margin-bottom:6px;text-transform:uppercase;">Step 2 · Connect Xero</div>
        OAuth flow from here. On success: chart of accounts loaded, account code mapping screen shown. Skippable — but Xero push will fail without completion.
      </div>
      <div style="padding:14px 16px;background:white;border-right:1px solid var(--mid);font-size:11px;color:var(--slate);line-height:1.8;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:var(--navy);font-weight:700;margin-bottom:6px;text-transform:uppercase;">Step 3 · Add first talent</div>
        Prompted to add one talent record. Skippable — empty state with add CTA shown if skipped. Talent Portal invite available from this step.
      </div>
      <div style="padding:14px 16px;background:white;font-size:11px;color:var(--slate);line-height:1.8;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:var(--purple);font-weight:700;margin-bottom:6px;text-transform:uppercase;">Step 4 · Add first client</div>
        Prompted to add one client with at least one PRIMARY contact. Skippable — empty state with add CTA if skipped.
      </div>
    </div>
    <div style="padding:10px 16px;background:#F8FAFF;border-top:1px solid var(--mid);font-size:10px;color:var(--grey);line-height:1.7;">
      On completion: land on empty deal pipeline Kanban. Setup checklist accessible from settings at any time. Progress indicator shown until all four steps are complete.
    </div>
  </div>

  <!-- TRANSACTIONAL EMAILS -->
  <div class="mono-label">Transactional emails — triggers and content</div>
  <table class="spec" style="margin-bottom:0;">
    <thead><tr><th>Email</th><th>Trigger</th><th>Recipient</th><th>Sender</th><th>Content</th></tr></thead>
    <tbody>
      <tr>
        <td>Agency admin invite</td>
        <td>Therum manually provisions account</td>
        <td>AGENCY_ADMIN email</td>
        <td>noreply@therum.io</td>
        <td>Welcome message, password-set link (expires 48h), link to onboarding checklist.</td>
      </tr>
      <tr>
        <td>Agency user invite</td>
        <td>AGENCY_ADMIN adds AGENT or FINANCE user</td>
        <td>New user email</td>
        <td>noreply@therum.io</td>
        <td>Invited by [agency name], role, password-set link (expires 48h).</td>
      </tr>
      <tr>
        <td>Talent portal invite</td>
        <td>Agency toggles portalEnabled on talent record</td>
        <td>talent.email</td>
        <td>noreply@therum.io</td>
        <td>Invited by [agency name] to view your deals and earnings. Magic link to set password (expires 72h). Brief explainer of what the portal shows.</td>
      </tr>
      <tr>
        <td>Invoice rejected notification</td>
        <td>Finance Portal FD rejects an invoice triplet</td>
        <td>AGENCY_AGENT who triggered the milestone completion</td>
        <td>noreply@therum.io</td>
        <td>Invoice triplet [INV-XXXX] for [deal title] was rejected by [FD name]. Rejection note: [note text]. Link to deal in Agency Portal.</td>
      </tr>
      <tr>
        <td>Payout summary generated</td>
        <td>FD clicks "Generate Payout Summary" in Payout Centre</td>
        <td>AGENCY_ADMIN (BCC)</td>
        <td>noreply@therum.io</td>
        <td>Payout summary for [date] generated. [N] talents, total net payout £[X]. Attached PDF. Reminder to make manual bank transfers.</td>
      </tr>
    </tbody>
  </table>


<!-- ═══ SECTION 6: XERO INTEGRATION SPEC ═══ -->
<div class="section-divider" style="background:#1A244E;">
  <div class="sd-num">06</div>
  <div class="sd-titles">
    <h2>Xero Integration Specification</h2>
    <p>OAuth flow, API calls, webhook handling, and error management</p>
  </div>
  <div class="sd-badge" style="background:rgba(30,85,204,0.3);color:#93C5FD;border:1px solid rgba(30,85,204,0.5);">INTEGRATION SPEC</div>
</div>

<div class="section">

  <div class="two-col" style="margin-bottom:28px;">
    <div>
      <div class="mono-label">OAuth 2.0 connect flow</div>
      <div class="code-block" style="font-size:10px;line-height:1.9;">
        <div class="c-comment">// 1. Finance Portal → "Connect Xero" button</div>
        <div><span class="c-key">GET</span> /auth/xero → redirect to Xero OAuth</div>
        <div class="c-comment">// 2. Xero redirect back with code</div>
        <div><span class="c-key">GET</span> /auth/xero/callback?code=XXX</div>
        <div class="c-comment">// 3. Exchange code for tokens</div>
        <div><span class="c-key">POST</span> https://identity.xero.com/connect/token</div>
        <div class="c-comment">// 4. Store encrypted in Agency record</div>
        <div><span class="c-val">agency.xeroTokens</span> = <span class="c-str">{ access, refresh, expiresAt }</span></div>
        <div><span class="c-val">agency.xeroTenantId</span> = selectedTenantId</div>
        <div class="c-comment">// 5. Token refresh: auto-refresh on 401</div>
      </div>
    </div>
    <div>
      <div class="mono-label">Scope required</div>
      <div class="code-block" style="font-size:10px;line-height:1.9;">
        <div class="c-comment">// Request these scopes at OAuth connect</div>
        <div class="c-val">openid</div>
        <div class="c-val">profile</div>
        <div class="c-val">email</div>
        <div class="c-val">accounting.contacts</div>
        <div class="c-val">accounting.transactions</div>
        <div class="c-val">accounting.settings</div>
        <div class="c-comment">// accounting.settings needed to read chart of accounts</div>
        <div class="c-comment">// during onboarding account code mapping</div>
      </div>
    </div>
  </div>

  <div class="mono-label">API calls required for MVP</div>
  <table class="spec" style="margin-bottom:24px;">
    <thead><tr><th>Action</th><th>Xero API Call</th><th>When</th><th>Notes</th></tr></thead>
    <tbody>
      <tr><td>Push client contact</td><td>POST /Contacts — IsCustomer: true</td><td>First deal with this client, or manual sync trigger</td><td>Push Organisation record + all ClientContacts as ContactPersons array. FINANCE role → IncludeInEmails: true. Deduplication by email. Store returned ContactID as client.xeroContactId.</td></tr>
      <tr><td>Push talent contact</td><td>POST /Contacts — IsSupplier: true</td><td>First deal with this talent, or manual sync trigger</td><td>Same deduplication logic. Store returned ContactID.</td></tr>
      <tr><td>Push INV (SELF_BILLING)</td><td>POST /Invoices — Type: ACCREC</td><td>On Finance Portal approval — SELF_BILLING agencies only</td><td>ContactID = client's xeroContactId. LineItems include account code, tax type. Agency VAT number on invoice.</td></tr>
      <tr><td>Push SBI (SELF_BILLING)</td><td>POST /Invoices — Type: ACCPAY</td><td>Same approval event as INV — SELF_BILLING only</td><td>ContactID = talent's xeroContactId. Account code = Talent Costs (COGS). VAT type per talent.vatRegistered.</td></tr>
      <tr><td>Push OBI (ON_BEHALF)</td><td>POST /Invoices — Type: ACCREC</td><td>On Finance Portal approval — ON_BEHALF agencies only</td><td>ContactID = client's xeroContactId. Talent name and VAT number in invoice reference/body if talent.vatRegistered. Tax type per talent.vatRegistered — NOT agency's VAT status. OBI must remain outstanding as a live receivable — do NOT apply CN against it at this stage.</td></tr>
      <tr><td>Push CN (ON_BEHALF)</td><td>POST /CreditNotes — Type: ACCREC</td><td>Same approval transaction as OBI — ON_BEHALF only</td><td>ContactID = client's xeroContactId. Amount, VAT type, and account code mirror OBI exactly. Store returned CreditNoteID as triplet.xeroCnId. <strong>Push as unallocated credit note — do NOT apply to OBI yet.</strong> CN is held until payout is confirmed. Client still sees full OBI outstanding in Xero, which is correct.</td></tr>
      <tr><td>Push COM (both models)</td><td>POST /Invoices — Type: ACCREC</td><td>Same approval event — both models</td><td>ContactID = talent's xeroContactId. Account code = Commission Income. VAT type per agency.vatRegistered. In ON_BEHALF: COM is settled by deduction at payout — never chased as an outstanding receivable.</td></tr>
      <tr><td>Read chart of accounts</td><td>GET /Accounts</td><td>During Finance Portal settings setup</td><td>Used to populate account code mapping dropdowns in settings.</td></tr>
      <tr><td>OBI / INV paid webhook</td><td>Webhook receiver: POST /webhooks/xero</td><td>Inbound from Xero when invoice status changes</td><td>SELF_BILLING: match xeroInvId → milestone PAID. ON_BEHALF: match xeroObiId → milestone PAID. Same downstream trigger in both models. Fetch invoice from Xero to confirm PAID before acting — do not trust event payload alone.</td></tr>
      <tr><td>Allocate CN against OBI (ON_BEHALF)</td><td>PUT /CreditNotes/{CreditNoteID}/Allocations</td><td>On payout confirmation in Payout Centre — ON_BEHALF only</td><td>Called after FD confirms payout in Finance Portal. Allocates the unallocated CN against the now-paid OBI. This clears the client account balance to net £0. Must only fire after OBI is confirmed PAID — never allocate CN against an unpaid OBI.</td></tr>
      <tr><td>Mark COM as PAID (ON_BEHALF)</td><td>POST /Payments against COM invoice</td><td>On payout confirmation — same event as CN allocation — ON_BEHALF only</td><td>Commission is deducted from talent payout, not collected separately. Marking COM as PAID in Xero at payout confirmation ensures it never appears as an outstanding receivable. Payment amount = com.net. Reference = payout run ID.</td></tr>
      <tr><td>Push Manual CN</td><td>POST /CreditNotes — Type: ACCREC</td><td>When FD confirms Manual CN in Finance Portal Credit Notes screen</td><td>ContactID = client's xeroContactId. Amount = ManualCreditNote.amount. Reference = MCN-XXXX. Description = ManualCreditNote.reason. Store returned CreditNoteID as ManualCreditNote.xeroCnId. Applies to both invoicing models.</td></tr>
      <tr><td>Amend invoice date (pre-paid)</td><td>PUT /Invoices/{InvoiceID}</td><td>When FD updates invoiceDate on an AUTHORISED (unpaid) invoice in Finance Portal</td><td>Update Date field on Xero invoice. Only permitted while invoice status = AUTHORISED in Xero. Blocked if invPaidAt is set. Log amendment in Therum with old/new date and userId.</td></tr>
    </tbody>
  </table>

  <div class="mono-label">Webhook setup & validation</div>
  <div class="code-block" style="font-size:10px;line-height:1.9;margin-bottom:24px;">
    <div class="c-comment">// Xero sends HMAC-SHA256 signed webhooks</div>
    <div class="c-comment">// Validate signature on every inbound request</div>
    <div><span class="c-key">const</span> isValid = crypto.createHmac(<span class="c-str">'sha256'</span>, XERO_WEBHOOK_KEY)</div>
    <div>  .update(rawBody).digest(<span class="c-str">'base64'</span>) === req.headers[<span class="c-str">'x-xero-signature'</span>]</div>
    <div style="height:6px;"></div>
    <div class="c-comment">// Intent to receive (ITR) — Xero sends challenge on webhook setup</div>
    <div class="c-comment">// Must respond with the challenge payload to confirm endpoint</div>
    <div class="c-key">if</div> (body.events.length === 0) <span class="c-op">return</span> res.json({ events: [], ...body })<span class="c-comment"> // ITR response</span>
    <div style="height:6px;"></div>
    <div class="c-comment">// Filter for relevant events</div>
    <div class="c-comment">// eventCategory: INVOICE · eventType: UPDATE</div>
    <div class="c-comment">// Fetch updated invoice from Xero to confirm PAID status (don't trust event alone)</div>
  </div>

  <div class="callout callout-amber" style="margin-bottom:24px;">
    <strong style="color:var(--amber);">Xero rate limits:</strong> Xero's API allows 60 calls/minute per app per tenant. Triplet push = 3 calls. At scale this is fine, but ensure the three invoice push calls are sequential with error handling — if call 2 (SBI) fails, the whole triplet should be rolled back (INV voided in Xero) to avoid partial states. Use a transaction wrapper around the three-call sequence.
  </div>

  <!-- ON_BEHALF SETTLEMENT SEQUENCE -->
  <div class="mono-label">ON_BEHALF — full payment and settlement sequence</div>
  <div class="callout callout-blue" style="margin-bottom:16px;">
    <strong style="color:var(--navy);">Why this differs from SELF_BILLING:</strong> In ON_BEHALF, the CN must be held unallocated until after the client has paid the OBI. If the CN is applied at push time, the OBI nets to £0 in Xero immediately — the client has nothing to pay against and the Xero payment webhook has nothing to fire on. The CN allocation and COM settlement both happen at payout confirmation, not at invoice generation.
  </div>

  <div style="background:#F8FAFF;border:1.5px solid var(--mid);border-radius:6px;padding:24px;overflow-x:auto;margin-bottom:24px;">
    <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--grey);letter-spacing:1px;text-transform:uppercase;margin-bottom:16px;">ON_BEHALF — step by step from approval to payout settlement</div>
    <div class="flow">
      <div class="node"><div class="node-box n-blue">FD Approves<br>Triplet<div class="node-sub">Finance Portal</div></div><div class="node-label">Approval trigger</div></div>
      <div class="arrow"><div class="line"></div><div class="head"></div></div>
      <div class="node"><div class="node-box n-navy">Push to Xero<div class="node-sub">OBI outstanding (£12k)<br>CN unallocated (£12k)<br>COM outstanding (£2.4k)</div></div><div class="node-label">3 calls · CN held unallocated</div></div>
      <div class="arrow"><div class="line"></div><div class="head"></div></div>
      <div class="node"><div class="node-box n-blue2">Client Pays<br>OBI in Xero<div class="node-sub">£12,000 allocated<br>to OBI by client's<br>accounts team</div></div><div class="node-label">Normal client payment flow</div></div>
      <div class="arrow"><div class="line"></div><div class="head"></div></div>
      <div class="node"><div class="node-box n-green">Xero Webhook<br>OBI Paid<div class="node-sub">Match xeroObiId<br>milestone → PAID<br>payoutStatus → READY</div></div><div class="node-label">Same trigger as SELF_BILLING INV</div></div>
      <div class="arrow"><div class="line"></div><div class="head"></div></div>
      <div class="node"><div class="node-box n-teal">FD Confirms<br>Payout<div class="node-sub">Net £9,600 to talent<br>Manual bank transfer</div></div><div class="node-label">Payout Centre action</div></div>
      <div class="arrow"><div class="line"></div><div class="head"></div></div>
      <div class="node"><div class="node-box n-teal2">Xero Settlement<div class="node-sub">CN allocated → OBI<br>Client balance = £0<br>COM marked PAID<br>by deduction</div></div><div class="node-label">2 API calls on payout confirm</div></div>
    </div>

    <div style="margin-top:20px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;font-size:10px;color:var(--slate);line-height:1.75;">
      <div style="background:white;border:1px solid var(--mid);border-radius:4px;padding:10px 12px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;color:var(--navy);margin-bottom:6px;">After push — Xero state</div>
        OBI: £12,000 OUTSTANDING<br>
        CN: £12,000 UNALLOCATED<br>
        COM: £2,400 OUTSTANDING<br>
        Net client liability: £12,000
      </div>
      <div style="background:white;border:1px solid var(--mid);border-radius:4px;padding:10px 12px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;color:var(--green);margin-bottom:6px;">After OBI paid — Xero state</div>
        OBI: £12,000 PAID<br>
        CN: £12,000 UNALLOCATED<br>
        COM: £2,400 OUTSTANDING<br>
        Payout READY in Therum
      </div>
      <div style="background:white;border:1px solid var(--mid);border-radius:4px;padding:10px 12px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;color:var(--teal);margin-bottom:6px;">After payout confirmed — Xero state</div>
        OBI: £12,000 PAID<br>
        CN: £12,000 ALLOCATED (nets OBI to £0)<br>
        COM: £2,400 PAID (deducted at source)<br>
        Agency P&L: £2,400 commission income only
      </div>
    </div>
  </div>

  <div class="mono-label">ON_BEHALF settlement — additional edge cases</div>
  <table class="spec" style="margin-bottom:24px;">
    <thead><tr><th>Scenario</th><th>Expected Behaviour</th></tr></thead>
    <tbody>
      <tr><td>CN allocated before OBI is paid</td><td>Must never happen. System must enforce: CN allocation API call is only made after triplet.invPaidAt is set (i.e. OBI webhook has been received and processed). Add a guard check before the allocation call — if OBI is not PAID in Therum, block CN allocation and log an error.</td></tr>
      <tr><td>FD confirms payout but CN allocation fails in Xero</td><td>Treat the same as any other Xero API failure — retry 3 times with exponential backoff. If all fail: payoutStatus remains PAID in Therum (payout has happened), but Finance Portal shows a "Xero settlement pending" warning on the milestone record with a manual retry button. Do not block or reverse the payout — the bank transfer has already been made.</td></tr>
      <tr><td>COM marked PAID fails in Xero</td><td>Same retry logic as CN allocation failure. COM will remain as an outstanding ACCREC in Xero temporarily. Finance Portal flags it. FD can manually mark it paid in Xero as a fallback — it will not appear in the overdue chase queue (filtered out for ON_BEHALF).</td></tr>
      <tr><td>COM invoice in ON_BEHALF overdue queue</td><td>COM invoices for ON_BEHALF agencies must be excluded from the Overdue Invoices screen at all times. Query filter: WHERE agency.invoicingModel = ON_BEHALF → exclude invoices where triplet.comNumber IS NOT NULL from the overdue list. COM is always settled at payout — it is never a receivable to chase.</td></tr>
    </tbody>
  </table>

  <div class="mono-label" style="margin-top:28px;">Xero token expiry & reconnection</div>
  <div class="callout callout-red" style="margin-bottom:16px;">
    <strong style="color:var(--red);">Important:</strong> Xero refresh tokens expire after <strong>60 days of inactivity</strong>. Auto-refresh on 401 handles normal expiry, but a 60-day inactive agency will get a 401 that cannot be refreshed — the token is dead. This must be handled explicitly, not silently fail.
  </div>
  <table class="spec" style="margin-bottom:24px;">
    <thead><tr><th>Scenario</th><th>Detection</th><th>UI Behaviour</th></tr></thead>
    <tbody>
      <tr><td>Access token expired (&lt;60 days)</td><td>401 response from Xero API</td><td>Auto-refresh using refresh token. Transparent to user. Retry original request.</td></tr>
      <tr><td>Refresh token expired (60+ days inactive)</td><td>400 / invalid_grant on refresh attempt</td><td>Finance Portal Xero Sync screen shows red "Xero disconnected" banner. xeroTokens and xeroTenantId cleared from Agency record. FD must reconnect via OAuth. Invoice pushes are blocked with in-queue warning until reconnected.</td></tr>
      <tr><td>Agency manually disconnects Xero</td><td>FD clicks "Disconnect" in settings</td><td>Same clearance of tokens. Confirmation modal warns that pushes will be blocked. Same reconnect flow.</td></tr>
    </tbody>
  </table>

  <div class="mono-label">Xero contact deduplication — edge cases</div>
  <table class="spec" style="margin-bottom:0;">
    <thead><tr><th>Scenario</th><th>Behaviour</th></tr></thead>
    <tbody>
      <tr><td>Contact found in Xero by matching email</td><td>Use existing Xero ContactID. Store on client/talent record. Do not create a duplicate. Update ContactPersons array with any new contacts from Therum.</td></tr>
      <tr><td>Contact exists in Xero but no email attached</td><td>Cannot match by email. Search by Name (exact match). If found: prompt FD in Finance Portal to confirm the match before storing ContactID. If not confirmed: create new contact.</td></tr>
      <tr><td>Multiple Xero contacts match by name</td><td>Do not auto-select. Surface all matches in Finance Portal with a "Choose which Xero contact to link" prompt. FD selects manually. Chosen ContactID stored.</td></tr>
      <tr><td>No match found (new client/talent)</td><td>Create new Xero contact via POST /Contacts. Store returned ContactID. Flag as "Xero contact created by Therum" in notes for auditability.</td></tr>
    </tbody>
  </table>

</div>


<!-- ═══ SECTION 7: VAT MONITOR SPEC ═══ -->
<div class="section-divider" style="background:#1A244E;">
  <div class="sd-num">07</div>
  <div class="sd-titles">
    <h2>VAT Threshold Monitor</h2>
    <p>Calculation logic, three-tier alert rules, and pipeline projection method</p>
  </div>
  <div class="sd-badge" style="background:rgba(30,85,204,0.3);color:#93C5FD;border:1px solid rgba(30,85,204,0.5);">COMPLIANCE FEATURE</div>
</div>

<div class="section">

  <div class="two-col">
    <div>
      <div class="mono-label">Calculation logic</div>
      <div class="code-block" style="font-size:10px;line-height:1.9;">
        <div class="c-comment">// For each talent where vatRegistered = false:</div>
        <div style="height:6px;"></div>
        <div class="c-comment">// Step 1: Rolling 12-month SBI total (invoiced)</div>
        <div><span class="c-key">historicalSBI</span> = SUM(</div>
        <div>  InvoiceTriplet.grossAmount</div>
        <div>  WHERE milestoneId.dealId.talentId = talent.id</div>
        <div>  AND triplet.issuedAt >= NOW() - 12 months</div>
        <div>  AND triplet.approvalStatus = APPROVED</div>
        <div>)<span class="c-comment"> // Uses issuedAt (date of supply) NOT invPaidAt — HMRC tests on when supply was made, not when paid</span></div>
        <div style="height:6px;"></div>
        <div class="c-comment">// Step 2: Pipeline projection (contracted deals)</div>
        <div><span class="c-key">pipelineSBI</span> = SUM(</div>
        <div>  Milestone.grossAmount</div>
        <div>  WHERE deal.talentId = talent.id</div>
        <div>  AND deal.stage IN [CONTRACTED, ACTIVE]</div>
        <div>  AND milestone.status NOT IN [PAID]</div>
        <div>  AND milestone.dueDate &lt;= NOW() + 12 months</div>
        <div>)<span class="c-comment"> // Only contracted — not pipeline probability</span></div>
        <div style="height:6px;"></div>
        <div class="c-comment">// Step 3: Determine tier</div>
        <div><span class="c-key">projected</span> = historicalSBI + pipelineSBI</div>
        <div><span class="c-key">tier</span> = projected >= 90000 ? <span class="c-str">'BREACHED'</span></div>
        <div>      : projected >= 85000 ? <span class="c-str">'IMMINENT'</span></div>
        <div>      : projected >= 75000 ? <span class="c-str">'APPROACHING'</span></div>
        <div>      : <span class="c-str">'CLEAR'</span></div>
      </div>
    </div>
    <div>
      <div class="mono-label">Alert tiers & UI treatment</div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px;">
        <div style="border-radius:4px;overflow:hidden;border:1.5px solid #FEE2E2;">
          <div style="background:#FEF2F2;padding:8px 14px;font-size:11px;font-weight:700;color:var(--red);display:flex;justify-content:space-between;">BREACHED <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;">≥ £90,000</span></div>
          <div style="background:white;padding:8px 14px;font-size:10px;color:var(--slate);line-height:1.7;">Red banner in both portals. Talent card flagged red. Projected total shown. Note: £90k is the mandatory registration threshold — talent is legally required to register. Agency must be notified immediately.</div>
        </div>
        <div style="border-radius:4px;overflow:hidden;border:1.5px solid #FDE68A;">
          <div style="background:#FFFBEB;padding:8px 14px;font-size:11px;font-weight:700;color:var(--amber);display:flex;justify-content:space-between;">IMMINENT <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;">£85,000 – £89,999</span></div>
          <div style="background:white;padding:8px 14px;font-size:10px;color:var(--slate);line-height:1.7;">Amber alert. Finance Portal dashboard badge. Talent record shows amber chip. Projected breach date shown based on pipeline cadence.</div>
        </div>
        <div style="border-radius:4px;overflow:hidden;border:1.5px solid var(--mid);">
          <div style="background:var(--light);padding:8px 14px;font-size:11px;font-weight:700;color:var(--grey);display:flex;justify-content:space-between;">APPROACHING <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;">£75,000 – £84,999</span></div>
          <div style="background:white;padding:8px 14px;font-size:10px;color:var(--slate);line-height:1.7;">Blue informational indicator. VAT Monitor table row highlighted. Not alarming — just awareness that talent is within £10k of the imminent tier.</div>
        </div>
      </div>
      <div class="callout callout-blue" style="margin-bottom:0;">
        <strong style="color:var(--navy);">Breach date projection:</strong> For APPROACHING/IMMINENT talent, display an estimated breach date. Method: take remaining headroom (£90k minus historicalSBI), divide by average monthly SBI from last 3 months, add result to today's date. Show as "Estimated VAT registration required by: [Month Year]." Flag as "Cannot project" if no deal history exists.
      </div>
    </div>
  </div>

</div>


<!-- ═══ SECTION 8: TECH STACK ═══ -->
<div class="section-divider" style="background:#1A244E;">
  <div class="sd-num">08</div>
  <div class="sd-titles">
    <h2>Tech Stack & Architecture Guidance</h2>
    <p>Existing foundation, recommended stack, and non-negotiable architectural decisions</p>
  </div>
  <div class="sd-badge" style="background:rgba(30,85,204,0.3);color:#93C5FD;border:1px solid rgba(30,85,204,0.5);">TECHNICAL</div>
</div>

<div class="section">

  <div class="callout callout-navy">
    <strong style="color:var(--navy);">Existing prototype:</strong> A React SPA prototype exists (private GitHub repo) with branding applied — navy #1A244E, brand blue #1E55CC, teal #0F766E/#14B8A6, purple #7C3AED for Talent portal. Fonts: Sora + IBM Plex Mono. The dev agency should assess the existing prototype for which components can be retained vs. rebuilt on a production-grade stack. The prototype demonstrates the intended UX direction and visual language.
  </div>

  <div class="mono-label">Recommended MVP stack</div>
  <div class="stack-grid">
    <div class="stack-card">
      <h4>Frontend</h4>
      <div class="items">
        React (existing) or Next.js<br>
        TypeScript<br>
        Tailwind CSS<br>
        React Query (server state)<br>
        React Hook Form (forms)<br>
        PDF generation: react-pdf or pdfmake
      </div>
    </div>
    <div class="stack-card">
      <h4>Backend</h4>
      <div class="items">
        Node.js + TypeScript<br>
        Express or Fastify<br>
        Prisma ORM<br>
        PostgreSQL (primary DB)<br>
        Redis (session, job queue)<br>
        BullMQ (webhook processing)
      </div>
    </div>
    <div class="stack-card">
      <h4>Infrastructure</h4>
      <div class="items">
        Hosting: Railway or Render (simple, cost-effective for MVP)<br>
        DB: Supabase or Railway Postgres<br>
        Email: Resend or Postmark<br>
        File storage: Cloudflare R2 (PDFs)<br>
        Secrets: Doppler or env vars
      </div>
    </div>
    <div class="stack-card">
      <h4>Third-Party APIs</h4>
      <div class="items">
        Xero API (OAuth 2.0 + webhooks)<br>
        Stripe (store credentials; no live payments in MVP)<br>
        Auth: NextAuth or Lucia<br>
        Monitoring: Sentry<br>
        Analytics: PostHog (user behaviour for beta)
      </div>
    </div>
  </div>

  <div class="mono-label">Non-negotiable architectural decisions</div>
  <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:24px;">
    <div style="display:flex;gap:12px;align-items:flex-start;font-size:11px;color:var(--slate);background:#F8FAFF;border:1px solid var(--mid);border-left:3px solid var(--blue);border-radius:0 4px 4px 0;padding:10px 14px;line-height:1.7;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;color:var(--blue);flex-shrink:0;min-width:120px;margin-top:1px;">MILESTONE SCOPING</div>
      <div>All invoice and payout logic must be scoped to milestoneId, not dealId. This is non-negotiable. See data model and invoice engine sections. Deal-level tracking will cause disbursement errors.</div>
    </div>
    <div style="display:flex;gap:12px;align-items:flex-start;font-size:11px;color:var(--slate);background:#F8FAFF;border:1px solid var(--mid);border-left:3px solid var(--blue);border-radius:0 4px 4px 0;padding:10px 14px;line-height:1.7;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;color:var(--blue);flex-shrink:0;min-width:120px;margin-top:1px;">ACCOUNTING ABSTRACTION</div>
      <div>Xero integration must be built behind an AccountingProvider interface. XeroProvider implements AccountingProvider. Core invoice logic has no Xero-specific types. This allows QuickBooks/Sage to be added in Y2 without restructuring the invoice engine.</div>
    </div>
    <div style="display:flex;gap:12px;align-items:flex-start;font-size:11px;color:var(--slate);background:#F8FAFF;border:1px solid var(--mid);border-left:3px solid var(--blue);border-radius:0 4px 4px 0;padding:10px 14px;line-height:1.7;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;color:var(--blue);flex-shrink:0;min-width:120px;margin-top:1px;">MULTI-TENANCY</div>
      <div>All database queries must be scoped to agencyId. No data from Agency A must ever be accessible to Agency B. Row-level security or middleware enforcement — not trust-based.</div>
    </div>
    <div style="display:flex;gap:12px;align-items:flex-start;font-size:11px;color:var(--slate);background:#F8FAFF;border:1px solid var(--mid);border-left:3px solid var(--blue);border-radius:0 4px 4px 0;padding:10px 14px;line-height:1.7;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;color:var(--blue);flex-shrink:0;min-width:120px;margin-top:1px;">XERO TOKENS</div>
      <div>Xero OAuth tokens must be stored encrypted at rest (not plain text). Use AES-256 encryption with a secret key stored in environment variables. Treat Xero tokens as credentials, not data.</div>
    </div>
    <div style="display:flex;gap:12px;align-items:flex-start;font-size:11px;color:var(--slate);background:#F8FAFF;border:1px solid var(--mid);border-left:3px solid var(--blue);border-radius:0 4px 4px 0;padding:10px 14px;line-height:1.7;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;color:var(--blue);flex-shrink:0;min-width:120px;margin-top:1px;">TRANSACTIONAL XERO PUSH</div>
      <div>The three-invoice push (INV + SBI + COM) must be treated as a single transaction. If any one of the three API calls fails, the others must be rolled back (voided in Xero). No partial triplet states should exist.</div>
    </div>
    <div style="display:flex;gap:12px;align-items:flex-start;font-size:11px;color:var(--slate);background:#F8FAFF;border:1px solid var(--mid);border-left:3px solid var(--blue);border-radius:0 4px 4px 0;padding:10px 14px;line-height:1.7;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;color:var(--blue);flex-shrink:0;min-width:120px;margin-top:1px;">WEBHOOK IDEMPOTENCY</div>
      <div>Xero may deliver the same webhook event more than once. All webhook handlers must be idempotent — processing the same event twice should produce the same result as processing it once. Use eventId deduplication in a processed_events table.</div>
    </div>
  </div>

  <div class="mono-label">Environments</div>
  <table class="spec" style="margin-bottom:24px;">
    <thead><tr><th>Environment</th><th>Purpose</th><th>Xero App</th><th>Notes</th></tr></thead>
    <tbody>
      <tr>
        <td>Development</td>
        <td>Local dev and internal testing. Not accessible to testers.</td>
        <td>Separate Xero developer app (demo company only)</td>
        <td>Can use Xero demo company for integration testing. No real agency Xero accounts.</td>
      </tr>
      <tr>
        <td>Staging</td>
        <td>Pre-release QA. Used by Therum to verify before deploying to production. May be used for onboarding dry-runs with testers.</td>
        <td>Separate Xero app — staging credentials</td>
        <td>Xero requires a separate app registration per environment. Staging app should have the same scopes as production. Webhook endpoint must be a public URL (use ngrok or a staging deployment — not localhost).</td>
      </tr>
      <tr>
        <td>Production</td>
        <td>Live environment for beta testers. Real agency Xero accounts. Real (manual) payout operations.</td>
        <td>Production Xero app — registered under therum.io</td>
        <td>Xero app must be submitted for review before any real tenant can connect. Allow ~2 weeks for Xero's app partner review process. Plan this into the build timeline.</td>
      </tr>
    </tbody>
  </table>

  <div class="mono-label">Data handling & UK GDPR</div>
  <div class="callout callout-navy" style="margin-bottom:24px;">
    <strong style="color:var(--navy);">UK GDPR applies.</strong> Therum processes personal data (talent names, emails, earnings) as a data controller on behalf of agencies. Minimum requirements for MVP:
    <br><br>
    <strong>Infrastructure:</strong> All personal data must be hosted in UK or EU infrastructure. Railway (EU region), Render (EU region), and Supabase (EU region) all qualify — confirm region selection explicitly with the dev agency. Do not default to US regions.
    <br><br>
    <strong>Data minimisation:</strong> Collect only what is needed. Talent Portal holds name, email, earnings, and remittances — nothing more. No unnecessary retention of bank details or personal identifiers beyond what Stripe Connect holds on Therum's behalf.
    <br><br>
    <strong>Access control:</strong> Multi-tenancy enforcement (agencyId scoping) is the primary technical safeguard. Talent Portal JWT scoped to talentId ensures no cross-talent data access. FINANCE role cannot see talent personal profiles. These must be verified in security testing before tester onboarding.
    <br><br>
    <strong>Data processing agreement:</strong> Therum should have a DPA with any sub-processors handling personal data (Railway/Render, Supabase, Resend/Postmark, PostHog). Standard SCCs or UK GDPR-compatible agreements required. Note for Bhavik: SeedLegals can generate a basic privacy policy and DPA template — add to pre-launch checklist.
  </div>

  <div class="mono-label">Branding reference</div>
  <div class="code-block" style="font-size:10px;line-height:2;">
    <div class="c-comment">// Therum brand tokens — apply consistently across all portals</div>
    <div><span class="c-key">--navy</span>:    <span class="c-val">#1A244E</span>  <span class="c-comment">// Primary brand — nav, headers</span></div>
    <div><span class="c-key">--blue</span>:    <span class="c-val">#1E55CC</span>  <span class="c-comment">// Brand blue — CTAs, links, active states</span></div>
    <div><span class="c-key">--teal</span>:    <span class="c-val">#0F766E</span>  <span class="c-comment">// Finance portal accent · SBI/payout elements</span></div>
    <div><span class="c-key">--teal-lt</span>: <span class="c-val">#14B8A6</span>  <span class="c-comment">// Lighter teal for Finance portal highlights</span></div>
    <div><span class="c-key">--purple</span>:  <span class="c-val">#7C3AED</span>  <span class="c-comment">// Talent portal accent — all talent-facing surfaces</span></div>
    <div><span class="c-key">--amber</span>:   <span class="c-val">#B45309</span>  <span class="c-comment">// Warnings — VAT alerts, overdue invoices</span></div>
    <div><span class="c-key">--green</span>:   <span class="c-val">#166534</span>  <span class="c-comment">// Success — paid status, approved state</span></div>
    <div><span class="c-key">fonts</span>:     <span class="c-val">Sora</span> (headings) + <span class="c-val">IBM Plex Mono</span> (data, labels, codes)</div>
  </div>

</div>


<!-- ═══ SECTION 9: USER STORIES ═══ -->
<div class="section-divider" style="background:#1A244E;">
  <div class="sd-num">09</div>
  <div class="sd-titles">
    <h2>Key User Stories — MVP Acceptance Criteria</h2>
    <p>The must-pass journeys that define MVP completion</p>
  </div>
  <div class="sd-badge" style="background:rgba(30,85,204,0.3);color:#93C5FD;border:1px solid rgba(30,85,204,0.5);">ACCEPTANCE</div>
</div>

<div class="section">

  <div class="mono-label" style="color:var(--blue);">Agency portal stories</div>
  <div class="story-list" style="margin-bottom:24px;">
    <div class="story" style="border-left-color:var(--blue);">
      <div class="story-id">AGN-01</div>
      <div class="story-text">As an agent, I can <strong>create a new deal</strong> by specifying client, talent, deal title, commission rate, and currency — and the deal appears on the Kanban board in the Pipeline stage.</div>
    </div>
    <div class="story" style="border-left-color:var(--blue);">
      <div class="story-id">AGN-02</div>
      <div class="story-text">As an agent, I can <strong>add multiple milestones</strong> to a deal, each with a gross amount, due date, and deliverable description. I can add, edit, and remove milestones as long as no invoice has been generated for them.</div>
    </div>
    <div class="story" style="border-left-color:var(--blue);">
      <div class="story-id">AGN-03</div>
      <div class="story-text">As an agent, I can <strong>mark a milestone as complete</strong>, which triggers the generation of an INV/SBI/COM triplet and places it in the Finance Portal approval queue. I see a confirmation of the amounts generated.</div>
    </div>
    <div class="story" style="border-left-color:var(--blue);">
      <div class="story-id">AGN-04</div>
      <div class="story-text">As an agent, I can see the <strong>VAT Monitor</strong> table showing all talent with their rolling 12-month SBI total, current tier, and projected breach date. Talent approaching the threshold are visually highlighted.</div>
    </div>
    <div class="story" style="border-left-color:var(--blue);">
      <div class="story-id">AGN-05</div>
      <div class="story-text">As an agent, I can <strong>drag a deal card</strong> between Kanban stages and the stage updates immediately. I can also view deals in a sortable table view and switch between views without losing my place.</div>
    </div>
    <div class="story" style="border-left-color:var(--blue);">
      <div class="story-id">AGN-06</div>
      <div class="story-text">As an agent, I can <strong>create a new client</strong> by entering the brand name, payment terms, and at least one PRIMARY contact (name, email). I can then add a FINANCE contact separately. The system prevents saving a client record with no PRIMARY contact, and prevents removing the last PRIMARY contact from an existing client.</div>
    </div>
    <div class="story" style="border-left-color:var(--blue);">
      <div class="story-id">AGN-07</div>
      <div class="story-text">As an agent, I can <strong>add a new talent</strong> to the roster by entering their name, email, default commission rate, and VAT registration status. I can toggle Talent Portal access on, which sends the talent an invite email. The talent record shows a VAT alert badge if their rolling SBI total is in an alert tier.</div>
    </div>
    <div class="story" style="border-left-color:var(--blue);">
      <div class="story-id">AGN-08</div>
      <div class="story-text">As an agent, when a <strong>credit note has been raised</strong> against a milestone requiring replacement, I see an amber "Replacement invoice required" badge on the deal card. I can create a new milestone on the same deal and link it as the replacement. Once linked, the badge clears and the new milestone follows the standard completion and invoicing flow. The cancelled milestone remains visible on the deal with a "Cancelled — CN raised" label for audit purposes.</div>
    </div>
    <div class="story" style="border-left-color:var(--blue);">
      <div class="story-id">AGN-09</div>
      <div class="story-text">As an agent, I can <strong>add an expense to a deal</strong> from the Expenses tab on the deal detail page. For each expense I enter a description, category, amount, and whether the expense was incurred by the agency or the talent. I then set two flags: <strong>Rechargeable to client</strong> (will this appear on the client invoice?) and <strong>Pre-approved in contract</strong> (was this agreed in the signed contract?). I can optionally pin the expense to a specific milestone; if left unpinned it is included on the next milestone invoice. I can upload a receipt. Once submitted the expense shows as PENDING until Finance approves it — I cannot approve my own expenses.</div>
    </div>
  </div>

  <div class="mono-label" style="color:var(--teal);">Finance portal stories</div>
  <div class="story-list" style="margin-bottom:24px;">
    <div class="story" style="border-left-color:var(--teal);">
      <div class="story-id">FIN-01</div>
      <div class="story-text">As a Finance Director, I can <strong>connect Xero</strong> via OAuth from the Finance Portal settings screen, and the connection status, tenant name, and last sync time are displayed on the Xero Sync screen.</div>
    </div>
    <div class="story" style="border-left-color:var(--teal);">
      <div class="story-id">FIN-02</div>
      <div class="story-text">As a Finance Director, I can <strong>review and approve an invoice triplet</strong> from the queue — seeing all three invoice PDFs inline, the calculated amounts for INV/SBI/COM, and the net payout to talent — before approving and pushing to Xero.</div>
    </div>
    <div class="story" style="border-left-color:var(--teal);">
      <div class="story-id">FIN-03</div>
      <div class="story-text">After I approve a triplet, <strong>three invoices appear in Xero</strong>: an ACCREC invoice to the client, an ACCPAY bill to the talent, and an ACCREC commission invoice to the talent — all with correct amounts, account codes, and contact references matching my Xero chart of accounts.</div>
    </div>
    <div class="story" style="border-left-color:var(--teal);">
      <div class="story-id">FIN-04</div>
      <div class="story-text">When I <strong>mark the client invoice as paid in Xero</strong>, the milestone status in Therum updates to PAID automatically (via webhook), and the milestone appears in the Payout Centre as ready for payout without any manual action on my part.</div>
    </div>
    <div class="story" style="border-left-color:var(--teal);">
      <div class="story-id">FIN-05</div>
      <div class="story-text">As a Finance Director, I can <strong>generate a payout summary</strong> from the Payout Centre for all ready milestones — producing a PDF remittance statement per talent showing gross SBI, commission deducted, and net payout — which I use to make manual bank transfers.</div>
    </div>
    <div class="story" style="border-left-color:var(--teal);">
      <div class="story-id">FIN-06</div>
      <div class="story-text">As a Finance Director, I can <strong>map each invoice type</strong> (INV/SBI/COM) to specific account codes from my Xero chart of accounts in the Finance Portal settings, and these codes are used on all subsequent Xero pushes.</div>
    </div>
    <div class="story" style="border-left-color:var(--teal);">
      <div class="story-id">FIN-07</div>
      <div class="story-text">As a Finance Director, I can <strong>amend the invoice date</strong> on a pending triplet in the Invoice Queue before approving it. The updated date appears on the PDF and is used as the Xero invoice date and VAT tax point. If the invoice has already been pushed to Xero and is unpaid, I can still update the date and Therum updates it in Xero automatically. The date is locked once the invoice is marked as paid.</div>
    </div>
    <div class="story" style="border-left-color:var(--teal);">
      <div class="story-id">FIN-08</div>
      <div class="story-text">As a Finance Director, I can <strong>raise a credit note</strong> against any approved invoice from the Finance Portal. I specify the amount (full or partial), a reason, and whether a replacement invoice is required. The CN PDF is generated and pushed to Xero. If a replacement is required, the original milestone is marked as cancelled and the agent is notified.</div>
    </div>
    <div class="story" style="border-left-color:var(--teal);">
      <div class="story-id">FIN-09</div>
      <div class="story-text">As a Finance Director, I have a dedicated <strong>Expense Approval queue</strong> in the Finance Portal, separate from the invoice approval queue. I can see all PENDING expenses across all deals — with the deal name, talent, description, category, amount, incurred-by, rechargeable flag, contract sign-off flag, and any uploaded receipt. I can approve or exclude each expense (exclusion requires a note). I cannot approve an expense I created myself. Approved expenses immediately become eligible for inclusion on the next invoice for their milestone or deal.</div>
    </div>
    <div class="story" style="border-left-color:var(--teal);">
      <div class="story-id">FIN-10</div>
      <div class="story-text">When I <strong>open an invoice in the approval queue</strong> that has rechargeable expenses attached, I see a summary panel showing each expense line item — description, amount, VAT, and contract sign-off status — that will be added to the INV. If all rechargeable expenses have <code>contractSignOff = true</code>, I can approve normally. If any rechargeable expense has <code>contractSignOff = false</code>, the approve button is replaced with an amber warning state: <em>"X rechargeable expense(s) not pre-approved in contract — confirm before sending."</em> I must tick a confirmation checkbox ("I confirm these expenses have been agreed with the client") before the approve button re-enables. My confirmation is logged against the invoice with my user ID and timestamp.</div>
    </div>
  </div>

  <div class="mono-label" style="color:var(--purple);">Talent portal stories</div>
  <div class="story-list">
    <div class="story" style="border-left-color:var(--purple);">
      <div class="story-id">TAL-01</div>
      <div class="story-text">As talent, I receive a <strong>portal invite email</strong> when my agency enables my Talent Portal access. I can set a password via the magic link and log in to see my own deals and earnings.</div>
    </div>
    <div class="story" style="border-left-color:var(--purple);">
      <div class="story-id">TAL-02</div>
      <div class="story-text">As talent, I can see the <strong>status of all my active deals</strong> — the client, milestone description, gross amount, my expected payout amount (net of commission), and current status — without needing to ask my agency.</div>
    </div>
    <div class="story" style="border-left-color:var(--purple);">
      <div class="story-id">TAL-03</div>
      <div class="story-text">As talent on a <strong>SELF_BILLING agency</strong>, I can download my remittance statements — one per payout run — showing the SBI reference, gross deal fee, commission deducted, any expense deductions (non-rechargeable expenses I incurred), and the net amount paid to me. I can also download each COM invoice showing the commission amount charged.</div>
    </div>
    <div class="story" style="border-left-color:var(--amber);">
      <div class="story-id">TAL-04</div>
      <div class="story-text">As talent on an <strong>ON_BEHALF agency</strong>, I can see a <strong>My Invoices</strong> tab showing all OBI invoices raised on my behalf — each labelled with the client name, OBI number, date, and gross amount. I can download each OBI as a PDF. For each invoice I can also download the corresponding COM showing the commission deducted. My remittance statement references the OBI number and shows gross, commission, and net payout. The CN (credit note) is not visible to me as it is an internal accounting entry.</div>
    </div>
  </div>

</div>


<!-- ═══ SECTION 10: BETA FEEDBACK FRAMEWORK ═══ -->
<div class="section-divider" style="background:#1A244E;">
  <div class="sd-num">10</div>
  <div class="sd-titles">
    <h2>Beta Feedback Framework</h2>
    <p>What to measure, what to ask, and what signals indicate product-market fit or a pivot</p>
  </div>
  <div class="sd-badge" style="background:rgba(30,85,204,0.3);color:#93C5FD;border:1px solid rgba(30,85,204,0.5);">POST-BUILD</div>
</div>

<div class="section">

  <div class="callout callout-green">
    <strong style="color:var(--green);">Instrumentation note:</strong> Install PostHog (or equivalent) from day one. Track: deal creation events, milestone completion events, invoice approval events, Xero push success/failure rates, Talent Portal logins, and VAT monitor page views. Behavioural data from 3–5 testers is more reliable than survey responses for identifying where the product breaks down.
  </div>

  <div class="feedback-cols">
    <div class="feedback-col">
      <h4>Questions to answer — data model</h4>
      <div class="q-list">
        <div class="q-item">Does the Deal / Milestone / Triplet structure map to how agencies actually think about their work, or do they need a different unit (e.g. "booking" vs "deal", "deliverable" vs "milestone")?</div>
        <div class="q-item">Are there deal types the model can't handle? (e.g. flat-fee retainers, usage-based deals, mother agency splits, multi-talent deals on a single brand contract)</div>
        <div class="q-item">Is commission always per-talent or do agencies sometimes split it differently (e.g. talent + management fee as separate lines)?</div>
        <div class="q-item">Do agencies ever need to bill partial milestones, or is milestone = invoice always the right granularity?</div>
      </div>
    </div>
    <div class="feedback-col">
      <h4>Questions to answer — Xero integration</h4>
      <div class="q-list">
        <div class="q-item">Do the three invoices arrive in Xero in a form that requires zero correction before the agency's accountant will accept them?</div>
        <div class="q-item">Is the INV as ACCREC / SBI as ACCPAY / COM as ACCREC mapping correct for how their Xero chart of accounts is structured?</div>
        <div class="q-item">Does Xero's SBI (ACCPAY bill to talent) create any issues in their reconciliation workflow?</div>
        <div class="q-item">Do testers have Xero accounts that are set up differently in a way that breaks the integration? (e.g. non-standard tax codes, multiple currencies)</div>
      </div>
    </div>
    <div class="feedback-col">
      <h4>Questions to answer — portals</h4>
      <div class="q-list">
        <div class="q-item">Is the two-portal model (Agency + Finance) the right UX pattern, or do smaller agencies want a single interface with role-based permissions?</div>
        <div class="q-item">Does the Finance Portal approval step add value or feel like unnecessary friction to the agent?</div>
        <div class="q-item">Do agents actually use the Talent Portal invitation feature, or is it seen as premature at this stage?</div>
        <div class="q-item">What's missing from the Agency Portal that agents need daily?</div>
      </div>
    </div>
    <div class="feedback-col">
      <h4>Pivot signals to watch for</h4>
      <div class="q-list">
        <div class="q-item" style="border-left-color:var(--red);">If more than 2 of 5 testers say the INV/SBI/COM construct doesn't map to their actual accounting workflow — the core model may need rethinking before scaling</div>
        <div class="q-item" style="border-left-color:var(--red);">If testers consistently correct the Xero invoices after push — the account code mapping or invoice type selection is wrong</div>
        <div class="q-item" style="border-left-color:var(--amber);">If testers say they'd want this "when it has a mobile app" — the desktop-first approach may need accelerating</div>
        <div class="q-item" style="border-left-color:var(--green);">If testers ask "when can we pay?" before the beta period ends — the product has crossed willingness-to-pay threshold</div>
      </div>
    </div>
  </div>

</div>


<!-- FOOTER -->
<div class="doc-footer">
  <span>THERUM-DEV-001 · v1.6 · April 2026 · Confidential</span>
  <span>Therum Technologies Ltd · therum.io · bhavik@therum.io</span>
</div>

</body>
</html>