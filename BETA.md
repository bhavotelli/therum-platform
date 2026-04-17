<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Therum — Beta Build Specification</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root {
  --bg:         #0D1526;
  --navy:       #1A244E;
  --surface:    #111827;
  --surface2:   #1C2A3A;
  --border:     rgba(255,255,255,0.07);
  --border-mid: rgba(255,255,255,0.13);
  --blue:       #1E55CC;
  --blue-lt:    #3B7DE8;
  --blue-dim:   rgba(30,85,204,0.18);
  --teal:       #14B8A6;
  --teal-dim:   rgba(20,184,166,0.15);
  --purple:     #8B5CF6;
  --purple-dim: rgba(139,92,246,0.15);
  --amber:      #F59E0B;
  --amber-dim:  rgba(245,158,11,0.15);
  --green:      #10B981;
  --green-dim:  rgba(16,185,129,0.15);
  --red:        #EF4444;
  --red-dim:    rgba(239,68,68,0.15);
  --indigo:     #6366F1;
  --indigo-dim: rgba(99,102,241,0.15);
  --text:       #F1F5F9;
  --text-2:     #94A3B8;
  --text-3:     #475569;
  --mono:       'IBM Plex Mono', monospace;
  --body:       'Sora', sans-serif;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body { font-family: var(--body); background: var(--bg); color: var(--text); font-size: 13px; line-height: 1.6; }

.wrap { max-width: 1080px; margin: 0 auto; padding: 0 52px; }

/* COVER */
.cover { background: var(--navy); border-bottom: 3px solid var(--blue); padding: 60px 52px 52px; position: relative; overflow: hidden; }
.cover::before { content: ''; position: absolute; top: -80px; right: -80px; width: 400px; height: 400px; background: radial-gradient(circle, rgba(30,85,204,0.2) 0%, transparent 65%); pointer-events: none; }
.cover-inner { max-width: 1080px; margin: 0 auto; display: flex; justify-content: space-between; align-items: flex-end; position: relative; z-index: 1; }
.cover-eyebrow { font-family: var(--mono); font-size: 10px; color: var(--blue-lt); letter-spacing: 2px; text-transform: uppercase; margin-bottom: 14px; }
.cover h1 { font-size: 44px; font-weight: 800; letter-spacing: -1.5px; line-height: 1.0; color: #fff; margin-bottom: 12px; }
.cover h1 em { font-style: normal; color: var(--teal); }
.cover-sub { font-size: 14px; font-weight: 300; color: rgba(255,255,255,0.5); max-width: 440px; line-height: 1.7; }
.cover-meta { text-align: right; font-family: var(--mono); }
.cover-meta .lbl { font-size: 9px; color: var(--text-3); letter-spacing: 1px; text-transform: uppercase; margin-top: 10px; }
.cover-meta .val { font-size: 11px; color: rgba(255,255,255,0.45); margin-top: 2px; }

/* SECTION HEADER */
.sec-head { background: var(--navy); border-bottom: 1px solid var(--border); border-top: 1px solid var(--border); padding: 14px 0; }
.sec-head-inner { display: flex; align-items: center; gap: 16px; }
.sec-num { font-family: var(--mono); font-size: 20px; font-weight: 700; color: rgba(255,255,255,0.08); flex-shrink: 0; }
.sec-title { font-size: 15px; font-weight: 700; color: #fff; }
.sec-sub { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 2px; }
.sec-badge { margin-left: auto; font-family: var(--mono); font-size: 9px; font-weight: 700; padding: 3px 9px; border-radius: 3px; flex-shrink: 0; }

.sec-body { padding: 44px 0; border-bottom: 1px solid var(--border); }

/* TYPOGRAPHY */
.mono-label { font-family: var(--mono); font-size: 9px; color: var(--text-3); letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 14px; }
.section-note { font-size: 12px; color: var(--text-2); line-height: 1.75; margin-bottom: 24px; max-width: 680px; }

/* CARD */
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.card-head { padding: 10px 16px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
.card-head-title { font-size: 12px; font-weight: 700; color: var(--text); }
.card-body { padding: 16px; }

/* CALLOUT */
.callout { border-radius: 6px; padding: 12px 16px; font-size: 11px; line-height: 1.75; border: 1px solid; margin-bottom: 20px; }
.callout-blue  { background: var(--blue-dim);   border-color: rgba(30,85,204,0.4);   color: #93C5FD; }
.callout-teal  { background: var(--teal-dim);   border-color: rgba(20,184,166,0.4);  color: #5EEAD4; }
.callout-amber { background: var(--amber-dim);  border-color: rgba(245,158,11,0.4);  color: #FCD34D; }
.callout-green { background: var(--green-dim);  border-color: rgba(16,185,129,0.4);  color: #6EE7B7; }
.callout-red   { background: var(--red-dim);    border-color: rgba(239,68,68,0.4);   color: #FCA5A5; }

/* GRIDS */
.g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.g3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }

/* ROLE CARD */
.role-card { background: var(--surface); border-radius: 8px; overflow: hidden; border: 1.5px solid; }
.role-head { padding: 12px 16px; }
.role-name { font-size: 13px; font-weight: 700; color: #fff; }
.role-who { font-size: 10px; font-weight: 400; opacity: 0.6; margin-top: 2px; }
.role-body { padding: 14px 16px; background: var(--surface); }
.perm-row { display: flex; align-items: flex-start; gap: 8px; padding: 5px 0; border-bottom: 1px solid var(--border); font-size: 11px; }
.perm-row:last-child { border-bottom: none; }
.perm-icon { flex-shrink: 0; font-size: 11px; margin-top: 1px; }
.perm-label { color: var(--text-2); line-height: 1.5; }
.perm-label strong { color: var(--text); font-weight: 600; }

/* PERMISSION MATRIX */
.perm-matrix { width: 100%; border-collapse: collapse; font-size: 11px; }
.perm-matrix th { background: var(--navy); color: #fff; padding: 9px 12px; text-align: left; font-size: 10px; font-weight: 700; white-space: nowrap; }
.perm-matrix th.action-col { width: 260px; }
.perm-matrix td { padding: 8px 12px; border-bottom: 1px solid var(--border); vertical-align: middle; text-align: center; }
.perm-matrix td.action-label { text-align: left; font-size: 11px; color: var(--text-2); }
.perm-matrix td.action-label .action-group { font-family: var(--mono); font-size: 9px; color: var(--text-3); letter-spacing: 1px; text-transform: uppercase; padding: 6px 0 3px; }
.perm-matrix tr:nth-child(even) td { background: rgba(255,255,255,0.02); }
.yes  { color: var(--green);  font-size: 14px; font-weight: 700; }
.no   { color: var(--text-3); font-size: 14px; }
.own  { color: var(--amber);  font-size: 10px; font-weight: 600; font-family: var(--mono); }
.ro   { color: var(--blue-lt); font-size: 10px; font-weight: 600; font-family: var(--mono); }

/* FLOW */
.flow { display: flex; align-items: flex-start; gap: 0; overflow-x: auto; padding-bottom: 8px; }
.flow-node { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
.fn-box { border-radius: 6px; padding: 10px 14px; font-size: 11px; font-weight: 600; text-align: center; min-width: 120px; max-width: 150px; line-height: 1.35; border: 1.5px solid; }
.fn-sub { font-size: 9px; font-weight: 400; margin-top: 4px; opacity: 0.75; font-family: var(--mono); }
.fn-label { font-family: var(--mono); font-size: 9px; color: var(--text-3); margin-top: 5px; text-align: center; max-width: 140px; line-height: 1.3; }
.flow-arrow { display: flex; align-items: center; flex-shrink: 0; margin-top: 12px; padding: 0 2px; }
.flow-arrow .line { height: 1.5px; width: 26px; background: var(--border-mid); }
.flow-arrow .head { width: 0; height: 0; border-top: 4px solid transparent; border-bottom: 4px solid transparent; border-left: 6px solid var(--border-mid); }
.flow-arrow.teal .line { background: var(--teal); } .flow-arrow.teal .head { border-left-color: var(--teal); }
.flow-arrow.blue .line { background: var(--blue-lt); } .flow-arrow.blue .head { border-left-color: var(--blue-lt); }
.flow-arrow.green .line { background: var(--green); } .flow-arrow.green .head { border-left-color: var(--green); }
.flow-arrow.amber .line { background: var(--amber); } .flow-arrow.amber .head { border-left-color: var(--amber); }
.flow-arrow.red .line { background: var(--red); } .flow-arrow.red .head { border-left-color: var(--red); }
.fn-navy   { background: rgba(26,36,78,0.8);   border-color: #2D3E7A;     color: #fff; }
.fn-blue   { background: var(--blue-dim);       border-color: var(--blue); color: #93C5FD; }
.fn-teal   { background: var(--teal-dim);       border-color: var(--teal); color: #5EEAD4; }
.fn-green  { background: var(--green-dim);      border-color: var(--green); color: #6EE7B7; }
.fn-amber  { background: var(--amber-dim);      border-color: var(--amber); color: #FCD34D; }
.fn-red    { background: var(--red-dim);        border-color: var(--red); color: #FCA5A5; }
.fn-purple { background: var(--purple-dim);     border-color: var(--purple); color: #C4B5FD; }
.fn-indigo { background: var(--indigo-dim);     border-color: var(--indigo); color: #A5B4FC; }

/* STEP LIST */
.step-list { display: flex; flex-direction: column; gap: 0; }
.step { display: flex; gap: 14px; padding: 11px 0; border-bottom: 1px solid var(--border); align-items: flex-start; }
.step:last-child { border-bottom: none; }
.step-num { font-family: var(--mono); font-size: 10px; font-weight: 700; min-width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
.step-content { flex: 1; }
.step-title { font-size: 12px; font-weight: 600; color: var(--text); margin-bottom: 3px; }
.step-desc { font-size: 11px; color: var(--text-2); line-height: 1.65; }
.step-code { font-family: var(--mono); font-size: 10px; background: rgba(255,255,255,0.05); border: 1px solid var(--border-mid); border-radius: 4px; padding: 6px 10px; margin-top: 7px; color: #7DD3FC; line-height: 1.7; }

/* DATA ROW */
.data-row { display: grid; grid-template-columns: 200px 120px 1fr; gap: 0; padding: 8px 16px; border-bottom: 1px solid var(--border); align-items: baseline; }
.data-row:last-child { border-bottom: none; }
.data-row:nth-child(even) { background: rgba(255,255,255,0.02); }
.data-row .field { font-family: var(--mono); font-size: 11px; color: var(--blue-lt); font-weight: 500; }
.data-row .type  { font-family: var(--mono); font-size: 10px; color: var(--text-3); padding: 0 6px; }
.data-row .note  { font-size: 11px; color: var(--text-2); line-height: 1.5; }
.data-row.pk .field { color: var(--amber); }
.data-row.enum .field { color: var(--purple); }
.data-row.flag .field { color: var(--green); }
.data-section-header { padding: 5px 16px; font-family: var(--mono); font-size: 9px; letter-spacing: 1px; text-transform: uppercase; background: rgba(255,255,255,0.03); border-bottom: 1px solid var(--border); color: var(--text-3); }

/* PDF FIELDS */
.pdf-field { display: flex; gap: 8px; padding: 7px 0; border-bottom: 1px solid var(--border); font-size: 11px; align-items: baseline; }
.pdf-field:last-child { border-bottom: none; }
.pdf-field-name { font-family: var(--mono); font-size: 10px; color: var(--teal); min-width: 200px; flex-shrink: 0; }
.pdf-field-desc { color: var(--text-2); line-height: 1.5; }

/* FOOTER */
.doc-footer { background: var(--navy); padding: 22px 52px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); }
.doc-footer span { font-family: var(--mono); font-size: 10px; color: var(--text-3); }
</style>
</head>
<body>

<div class="cover">
  <div class="cover-inner">
    <div>
      <div class="cover-eyebrow">Therum Technologies Ltd</div>
      <h1>Beta Build<br><em>Specification</em></h1>
      <p class="cover-sub">Admin access, user management, role permissions, Xero OAuth connect, and manual payout export. Everything needed to stand up and hand off the beta.</p>
    </div>
    <div class="cover-meta">
      <div class="lbl">Document</div><div class="val">THERUM-BETA-001</div>
      <div class="lbl">Version</div><div class="val">v1.0 · April 2026</div>
      <div class="lbl">Scope</div><div class="val">Beta / Design Partner Build</div>
      <div class="lbl">Classification</div><div class="val">Confidential</div>
    </div>
  </div>
</div>


<div class="sec-head"><div class="wrap"><div class="sec-head-inner">
  <span class="sec-num">01</span>
  <div><div class="sec-title">User & Role Model</div><div class="sec-sub">Five roles · what each can see and do · how access is granted</div></div>
  <span class="sec-badge" style="background:var(--blue-dim);color:#93C5FD;border:1px solid rgba(30,85,204,0.4);">Access Control</span>
</div></div></div>

<div class="sec-body"><div class="wrap">

  <p class="section-note">Every user in the system belongs to one role. Role determines which portal they land on, what data they can see, and what actions they can take. Access is granted top-down: Super Admin creates Agency accounts, Agency Admin invites their own users. Talent portal access is toggled per talent by the Agency Admin.</p>

  <div class="mono-label">Five Roles</div>
  <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:32px;">

    <div class="role-card" style="border-color:rgba(239,68,68,0.4);">
      <div class="role-head" style="background:var(--red-dim);">
        <div class="role-name">Super Admin</div>
        <div class="role-who">Bhav · Therum internal only</div>
      </div>
      <div class="role-body">
        <div class="perm-row"><span class="perm-icon" style="color:var(--green);">✓</span><span class="perm-label">Create / suspend agencies</span></div>
        <div class="perm-row"><span class="perm-icon" style="color:var(--green);">✓</span><span class="perm-label">Add users to any agency</span></div>
        <div class="perm-row"><span class="perm-icon" style="color:var(--green);">✓</span><span class="perm-label">View all data across all agencies</span></div>
        <div class="perm-row"><span class="perm-icon" style="color:var(--green);">✓</span><span class="perm-label">Reset passwords · impersonate (read-only)</span></div>
        <div class="perm-row"><span class="perm-icon" style="color:var(--green);">✓</span><span class="perm-label">View Xero connection status per agency</span></div>
        <div class="perm-row"><span class="perm-icon" style="color:var(--green);">✓</span><span class="perm-label">Trigger manual Xero re-sync</span></div>
      </div>
    </div>

    <div class="role-card" style="border-color:rgba(30,85,204,0.4);">
      <div class="role-head" style="background:var(--blue-dim);">
        <div class="role-name">Agency Admin</div>
        <div class="role-who">Senior agent · MD of the agency</div>
      </div>
      <div class="role-body">
        <div class="perm-row"><span class="perm-icon" style="color:var(--green);">✓</span><span class="perm-label">Invite agents and finance users</span></div>
        <div class="perm-row"><span class="perm-icon" style="color:var(--green);">✓</span><span class="perm-label">Full agency portal access</span></div>
        <div class="perm-row"><span class="perm-icon" style="color:var(--green);">✓</span><span class="perm-label">Connect Xero (OAuth)</span></div>
        <div class="perm-row"><span class="perm-icon" style="color:var(--green);">✓</span><span class="perm-label">Toggle talent portal access per talent</span></div>
        <div class="perm-row"><span class="perm-icon" style="color:var(--green);">✓</span><span class="perm-label">Set invoicing model and agency defaults</span></div>
        <div class="perm-row"><span class="perm-icon" style="color:var(--amber);">~</span><span class="perm-label">Finance portal: read-only view</span></div>
      </div>
    </div>

    <div class="role-card" style="border-color:rgba(59,125,232,0.35);">
      <div class="role-head" style="background:rgba(59,125,232,0.12);">
        <div class="role-name">Agent</div>
        <div class="role-who">Talent manager · account manager</div>
      </div>
      <div class="role-body">
        <div class="perm-row"><span class="perm-icon" style="color:var(--green);">✓</span><span class="perm-label">Create and manage deals</span></div>
        <div class="perm-row"><span class="perm-icon" style="color:var(--green);">✓</span><span class="perm-label">Add milestones and deliverables</span></div>
        <div class="perm-row"><span class="perm-icon" style="color:var(--green);">✓</span><span class="perm-label">Mark deliverables approved</span></div>
        <div class="perm-row"><span class="perm-icon" style="color:var(--green);">✓</span><span class="perm-label">Add deal expenses</span></div>
        <div class="perm-row"><span class="perm-icon" style="color:var(--green);">✓</span><span class="perm-label">View own deals only (not other agents')</span></div>
        <div class="perm-row"><span class="perm-icon" style="color:var(--red);">✗</span><span class="perm-label">Cannot approve invoices or run payouts</span></div>
      </div>
    </div>

    <div class="role-card" style="border-color:rgba(20,184,166,0.4);">
      <div class="role-head" style="background:var(--teal-dim);">
        <div class="role-name">Finance</div>
        <div class="role-who">FD · bookkeeper · finance manager</div>
      </div>
      <div class="role-body">
        <div class="perm-row"><span class="perm-icon" style="color:var(--green);">✓</span><span class="perm-label">Invoice approval queue — full access</span></div>
        <div class="perm-row"><span class="perm-icon" style="color:var(--green);">✓</span><span class="perm-label">Run payout batches · export remittances</span></div>
        <div class="perm-row"><span class="perm-icon" style="color:var(--green);">✓</span><span class="perm-label">Raise manual credit notes</span></div>
        <div class="perm-row"><span class="perm-icon" style="color:var(--green);">✓</span><span class="perm-label">Log chase notes on overdue invoices</span></div>
        <div class="perm-row"><span class="perm-icon" style="color:var(--green);">✓</span><span class="perm-label">Approve deal expenses</span></div>
        <div class="perm-row"><span class="perm-icon" style="color:var(--amber);">~</span><span class="perm-label">Agency portal: read-only view of deals</span></div>
      </div>
    </div>

    <div class="role-card" style="border-color:rgba(139,92,246,0.4);">
      <div class="role-head" style="background:var(--purple-dim);">
        <div class="role-name">Talent</div>
        <div class="role-who">Creator · represented talent</div>
      </div>
      <div class="role-body">
        <div class="perm-row"><span class="perm-icon" style="color:var(--green);">✓</span><span class="perm-label">View own deals and milestone status</span></div>
        <div class="perm-row"><span class="perm-icon" style="color:var(--green);">✓</span><span class="perm-label">View payout schedule and amounts</span></div>
        <div class="perm-row"><span class="perm-icon" style="color:var(--green);">✓</span><span class="perm-label">Download remittance PDFs</span></div>
        <div class="perm-row"><span class="perm-icon" style="color:var(--green);">✓</span><span class="perm-label">View earnings history</span></div>
        <div class="perm-row"><span class="perm-icon" style="color:var(--red);">✗</span><span class="perm-label">Cannot see other talent's data</span></div>
        <div class="perm-row"><span class="perm-icon" style="color:var(--red);">✗</span><span class="perm-label">Cannot see full invoice detail</span></div>
      </div>
    </div>

  </div>

  <div class="mono-label">Permission Matrix</div>
  <div style="border-radius:8px;overflow:hidden;border:1px solid var(--border);margin-bottom:0;">
    <table class="perm-matrix" style="width:100%;">
      <thead>
        <tr>
          <th class="action-col" style="text-align:left;">Action</th>
          <th style="color:#FCA5A5;">Super Admin</th>
          <th style="color:#93C5FD;">Agency Admin</th>
          <th style="color:#7DD3FC;">Agent</th>
          <th style="color:#5EEAD4;">Finance</th>
          <th style="color:#C4B5FD;">Talent</th>
        </tr>
      </thead>
      <tbody>
        <tr><td colspan="6" class="action-label"><div class="action-group">User & Agency Management</div></td></tr>
        <tr><td class="action-label">Create agency</td><td><span class="yes">✓</span></td><td><span class="no">—</span></td><td><span class="no">—</span></td><td><span class="no">—</span></td><td><span class="no">—</span></td></tr>
        <tr><td class="action-label">Invite users to agency</td><td><span class="yes">✓</span></td><td><span class="yes">✓</span></td><td><span class="no">—</span></td><td><span class="no">—</span></td><td><span class="no">—</span></td></tr>
        <tr><td class="action-label">Suspend / reactivate user</td><td><span class="yes">✓</span></td><td><span class="yes">✓</span></td><td><span class="no">—</span></td><td><span class="no">—</span></td><td><span class="no">—</span></td></tr>
        <tr><td class="action-label">Reset user password</td><td><span class="yes">✓</span></td><td><span class="yes">✓</span></td><td><span class="no">—</span></td><td><span class="no">—</span></td><td><span class="no">—</span></td></tr>
        <tr><td class="action-label">Connect Xero (OAuth)</td><td><span class="yes">✓</span></td><td><span class="yes">✓</span></td><td><span class="no">—</span></td><td><span class="no">—</span></td><td><span class="no">—</span></td></tr>
        <tr><td class="action-label">Set agency invoicing model</td><td><span class="yes">✓</span></td><td><span class="yes">✓</span></td><td><span class="no">—</span></td><td><span class="no">—</span></td><td><span class="no">—</span></td></tr>
        <tr><td colspan="6" class="action-label"><div class="action-group">Deal & Pipeline</div></td></tr>
        <tr><td class="action-label">Create deal</td><td><span class="yes">✓</span></td><td><span class="yes">✓</span></td><td><span class="yes">✓</span></td><td><span class="no">—</span></td><td><span class="no">—</span></td></tr>
        <tr><td class="action-label">View all deals (any agent)</td><td><span class="yes">✓</span></td><td><span class="yes">✓</span></td><td><span class="own">Own only</span></td><td><span class="ro">Read only</span></td><td><span class="own">Own only</span></td></tr>
        <tr><td class="action-label">Advance deal stage</td><td><span class="yes">✓</span></td><td><span class="yes">✓</span></td><td><span class="yes">✓</span></td><td><span class="no">—</span></td><td><span class="no">—</span></td></tr>
        <tr><td class="action-label">Add / edit milestones</td><td><span class="yes">✓</span></td><td><span class="yes">✓</span></td><td><span class="yes">✓</span></td><td><span class="no">—</span></td><td><span class="no">—</span></td></tr>
        <tr><td class="action-label">Add / approve deliverables</td><td><span class="yes">✓</span></td><td><span class="yes">✓</span></td><td><span class="yes">✓</span></td><td><span class="ro">Read only</span></td><td><span class="ro">Read only</span></td></tr>
        <tr><td class="action-label">Add deal expense</td><td><span class="yes">✓</span></td><td><span class="yes">✓</span></td><td><span class="yes">✓</span></td><td><span class="no">—</span></td><td><span class="no">—</span></td></tr>
        <tr><td colspan="6" class="action-label"><div class="action-group">Invoice & Finance</div></td></tr>
        <tr><td class="action-label">Approve invoice → push to Xero</td><td><span class="yes">✓</span></td><td><span class="no">—</span></td><td><span class="no">—</span></td><td><span class="yes">✓</span></td><td><span class="no">—</span></td></tr>
        <tr><td class="action-label">Amend invoice date (pre-push)</td><td><span class="yes">✓</span></td><td><span class="no">—</span></td><td><span class="no">—</span></td><td><span class="yes">✓</span></td><td><span class="no">—</span></td></tr>
        <tr><td class="action-label">Raise manual credit note</td><td><span class="yes">✓</span></td><td><span class="no">—</span></td><td><span class="no">—</span></td><td><span class="yes">✓</span></td><td><span class="no">—</span></td></tr>
        <tr><td class="action-label">Approve deal expense</td><td><span class="yes">✓</span></td><td><span class="no">—</span></td><td><span class="no">—</span></td><td><span class="yes">✓</span></td><td><span class="no">—</span></td></tr>
        <tr><td class="action-label">Log chase note</td><td><span class="yes">✓</span></td><td><span class="no">—</span></td><td><span class="no">—</span></td><td><span class="yes">✓</span></td><td><span class="no">—</span></td></tr>
        <tr><td colspan="6" class="action-label"><div class="action-group">Payouts</div></td></tr>
        <tr><td class="action-label">Run payout batch</td><td><span class="yes">✓</span></td><td><span class="no">—</span></td><td><span class="no">—</span></td><td><span class="yes">✓</span></td><td><span class="no">—</span></td></tr>
        <tr><td class="action-label">Export remittance PDF</td><td><span class="yes">✓</span></td><td><span class="no">—</span></td><td><span class="no">—</span></td><td><span class="yes">✓</span></td><td><span class="ro">Own only</span></td></tr>
        <tr><td class="action-label">Export bank transfer CSV</td><td><span class="yes">✓</span></td><td><span class="no">—</span></td><td><span class="no">—</span></td><td><span class="yes">✓</span></td><td><span class="no">—</span></td></tr>
      </tbody>
    </table>
  </div>

</div></div>


<div class="sec-head"><div class="wrap"><div class="sec-head-inner">
  <span class="sec-num">02</span>
  <div><div class="sec-title">Super Admin Panel</div><div class="sec-sub">Bhav's control layer — agency creation, user management, Xero health</div></div>
  <span class="sec-badge" style="background:var(--red-dim);color:#FCA5A5;border:1px solid rgba(239,68,68,0.3);">Internal Only</span>
</div></div></div>

<div class="sec-body"><div class="wrap">

  <div class="callout callout-red" style="margin-bottom:28px;">
    <strong>Never customer-facing.</strong> The Super Admin panel is Bhav's internal tool only. Accessible via a protected route (e.g. <span style="font-family:var(--mono);font-size:10px;">/admin</span>) requiring a separate admin credential on top of normal login. No agency user ever sees this panel or knows it exists.
  </div>

  <div class="g2" style="margin-bottom:28px;">

    <div class="card">
      <div class="card-head" style="background:var(--red-dim);border-color:rgba(239,68,68,0.2);">
        <div class="card-head-title" style="color:#FCA5A5;">Agency Management</div>
      </div>
      <div class="card-body" style="padding:0;">
        <div class="step-list" style="padding:0 16px;">
          <div class="step">
            <div class="step-num" style="background:var(--red-dim);color:var(--red);">1</div>
            <div class="step-content">
              <div class="step-title">Create Agency</div>
              <div class="step-desc">Form: Agency name, primary contact email, invoicing model (SELF_BILLING / ON_BEHALF), VAT registered Y/N. Creates Agency record and generates the Agency Admin user account.</div>
              <div class="step-code">POST /admin/agencies<br>→ agency.id + agencyAdmin user created<br>→ invite email sent to primary contact</div>
            </div>
          </div>
          <div class="step">
            <div class="step-num" style="background:var(--red-dim);color:var(--red);">2</div>
            <div class="step-content">
              <div class="step-title">View Agency Detail</div>
              <div class="step-desc">Per-agency dashboard showing: plan status, user list + roles, Xero connection status, total deals, total invoices pushed, last activity timestamp.</div>
            </div>
          </div>
          <div class="step">
            <div class="step-num" style="background:var(--red-dim);color:var(--red);">3</div>
            <div class="step-content">
              <div class="step-title">Suspend / Reactivate Agency</div>
              <div class="step-desc">Toggle agency.active flag. Suspended agencies: all users locked out, data preserved, Xero connection maintained. Reactivation restores access immediately.</div>
            </div>
          </div>
          <div class="step" style="border:none;">
            <div class="step-num" style="background:var(--red-dim);color:var(--red);">4</div>
            <div class="step-content">
              <div class="step-title">Impersonate (read-only)</div>
              <div class="step-desc">Super Admin can view any agency's portal as a read-only observer for support purposes. All impersonation sessions are logged: adminUserId, agencyId, startedAt, endedAt. No write actions permitted during impersonation.</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head" style="background:var(--blue-dim);border-color:rgba(30,85,204,0.2);">
        <div class="card-head-title" style="color:#93C5FD;">User Management</div>
      </div>
      <div class="card-body" style="padding:0;">
        <div class="step-list" style="padding:0 16px;">
          <div class="step">
            <div class="step-num" style="background:var(--blue-dim);color:var(--blue-lt);">1</div>
            <div class="step-content">
              <div class="step-title">Add User to Agency</div>
              <div class="step-desc">Super Admin can add a user to any agency directly. Fields: email, role (AGENCY_ADMIN / AGENT / FINANCE / TALENT), agencyId. Invite email sent with magic link.</div>
              <div class="step-code">POST /admin/users<br>{ email, role, agencyId, talentId? }<br>→ invite token generated (24hr expiry)</div>
            </div>
          </div>
          <div class="step">
            <div class="step-num" style="background:var(--blue-dim);color:var(--blue-lt);">2</div>
            <div class="step-content">
              <div class="step-title">Reset Password</div>
              <div class="step-desc">Trigger password reset email for any user. Useful for beta testers who lose access. Magic link valid for 1 hour.</div>
            </div>
          </div>
          <div class="step">
            <div class="step-num" style="background:var(--blue-dim);color:var(--blue-lt);">3</div>
            <div class="step-content">
              <div class="step-title">Change User Role</div>
              <div class="step-desc">Update user.role for any user within an agency. Effective immediately on next page load. Logged with changedBy and changedAt.</div>
            </div>
          </div>
          <div class="step" style="border:none;">
            <div class="step-num" style="background:var(--blue-dim);color:var(--blue-lt);">4</div>
            <div class="step-content">
              <div class="step-title">Suspend / Reactivate User</div>
              <div class="step-desc">Toggle user.active. Suspended user is immediately logged out and cannot re-authenticate. Data and audit trail preserved.</div>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>

  <div class="mono-label">User Entity — Data Model</div>
  <div style="border-radius:8px;overflow:hidden;border:1px solid var(--border);margin-bottom:28px;">
    <div class="data-row pk"><span class="field">id</span><span class="type">UUID</span><span class="note">Primary key</span></div>
    <div class="data-row"><span class="field">agencyId</span><span class="type">UUID</span><span class="note">→ Agency. Null for Super Admin users.</span></div>
    <div class="data-row"><span class="field">talentId</span><span class="type">UUID?</span><span class="note">→ Talent. Set only for TALENT role users. Links the user account to a talent record.</span></div>
    <div class="data-row"><span class="field">email</span><span class="type">String</span><span class="note">Unique. Used for login and invite delivery.</span></div>
    <div class="data-row"><span class="field">name</span><span class="type">String</span><span class="note">Display name</span></div>
    <div class="data-row enum"><span class="field">role</span><span class="type">Enum</span><span class="note">SUPER_ADMIN | AGENCY_ADMIN | AGENT | FINANCE | TALENT</span></div>
    <div class="data-row flag"><span class="field">active</span><span class="type">Boolean</span><span class="note">False = suspended. User cannot authenticate. Default true on creation.</span></div>
    <div class="data-row"><span class="field">inviteToken</span><span class="type">String?</span><span class="note">Set on invite, cleared on first login. 24hr expiry for Agency Admin invites, 1hr for password reset.</span></div>
    <div class="data-row"><span class="field">inviteExpiry</span><span class="type">DateTime?</span><span class="note">Token invalidated if now > inviteExpiry</span></div>
    <div class="data-row"><span class="field">lastLoginAt</span><span class="type">DateTime?</span><span class="note">Updated on every successful authentication. Useful for monitoring beta engagement.</span></div>
    <div class="data-row"><span class="field">createdAt</span><span class="type">DateTime</span><span class="note">Auto-set on creation</span></div>
    <div class="data-row"><span class="field">createdBy</span><span class="type">String</span><span class="note">User ID of whoever created this account (Super Admin or Agency Admin)</span></div>
  </div>

  <div class="mono-label">Post-Login Portal Routing</div>
  <div class="callout callout-blue" style="margin-bottom:0;">
    On successful authentication, route user based on role: <strong>SUPER_ADMIN → /admin</strong> &nbsp;·&nbsp; <strong>AGENCY_ADMIN / AGENT → /agency/pipeline</strong> &nbsp;·&nbsp; <strong>FINANCE → /finance/invoices</strong> &nbsp;·&nbsp; <strong>TALENT → /talent/deals</strong>. If a user attempts to access a route outside their role, redirect to their default landing page with a 403 toast. Never show a blank error page.
  </div>

</div></div>


<div class="sec-head"><div class="wrap"><div class="sec-head-inner">
  <span class="sec-num">03</span>
  <div><div class="sec-title">Onboarding Flows</div><div class="sec-sub">How each user type gets access · invite → first login → setup</div></div>
  <span class="sec-badge" style="background:var(--teal-dim);color:#5EEAD4;border:1px solid rgba(20,184,166,0.3);">Flows</span>
</div></div></div>

<div class="sec-body"><div class="wrap">

  <div class="g2" style="margin-bottom:28px;">

    <div>
      <div class="mono-label">Flow A · New Agency Onboarding (Bhav-initiated)</div>
      <div style="overflow-x:auto;margin-bottom:16px;">
        <div class="flow" style="min-width:580px;">
          <div class="flow-node"><div class="fn-box fn-red">Bhav creates agency<div class="fn-sub">Admin panel form</div></div><div class="fn-label">POST /admin/agencies</div></div>
          <div class="flow-arrow red"><div class="line"></div><div class="head"></div></div>
          <div class="flow-node"><div class="fn-box fn-amber">Invite email sent<div class="fn-sub">To Agency Admin email</div></div><div class="fn-label">Magic link · 24hr expiry</div></div>
          <div class="flow-arrow amber"><div class="line"></div><div class="head"></div></div>
          <div class="flow-node"><div class="fn-box fn-blue">Agency Admin clicks link<div class="fn-sub">Sets password · logs in</div></div><div class="fn-label">inviteToken cleared</div></div>
          <div class="flow-arrow blue"><div class="line"></div><div class="head"></div></div>
          <div class="flow-node"><div class="fn-box fn-teal">Agency setup wizard<div class="fn-sub">VAT status · Xero connect</div></div><div class="fn-label">Settings saved · ready</div></div>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><div class="card-head-title">Agency Setup Wizard — Steps</div></div>
        <div class="card-body" style="padding:0;">
          <div class="step-list" style="padding:0 16px;">
            <div class="step"><div class="step-num" style="background:var(--blue-dim);color:var(--blue-lt);">1</div><div class="step-content"><div class="step-title">Confirm agency details</div><div class="step-desc">Review name, invoicing model, VAT status. Editable here — locked once first deal is created.</div></div></div>
            <div class="step"><div class="step-num" style="background:var(--teal-dim);color:var(--teal);">2</div><div class="step-content"><div class="step-title">Connect Xero</div><div class="step-desc">OAuth connect button. If skipped, Finance Portal functions requiring Xero are disabled with a "Connect Xero to unlock" prompt.</div></div></div>
            <div class="step"><div class="step-num" style="background:var(--amber-dim);color:var(--amber);">3</div><div class="step-content"><div class="step-title">Invite your team</div><div class="step-desc">Optional — add agents and finance users now. Can be done later from Settings.</div></div></div>
            <div class="step" style="border:none;"><div class="step-num" style="background:var(--green-dim);color:var(--green);">4</div><div class="step-content"><div class="step-title">Done — go to pipeline</div><div class="step-desc">Wizard complete. Redirects to /agency/pipeline. Empty state shown with "Create your first deal" CTA.</div></div></div>
          </div>
        </div>
      </div>
    </div>

    <div>
      <div class="mono-label">Flow B · Talent Portal Access (Agency Admin-initiated)</div>
      <div style="overflow-x:auto;margin-bottom:16px;">
        <div class="flow" style="min-width:520px;">
          <div class="flow-node"><div class="fn-box fn-blue">Agency Admin toggles portal access<div class="fn-sub">On talent profile</div></div><div class="fn-label">talent.portalAccess = true</div></div>
          <div class="flow-arrow blue"><div class="line"></div><div class="head"></div></div>
          <div class="flow-node"><div class="fn-box fn-amber">Invite email sent<div class="fn-sub">To talent.email</div></div><div class="fn-label">User record created<br>role = TALENT</div></div>
          <div class="flow-arrow amber"><div class="line"></div><div class="head"></div></div>
          <div class="flow-node"><div class="fn-box fn-purple">Talent clicks link<div class="fn-sub">Sets password</div></div><div class="fn-label">Routes to /talent/deals</div></div>
        </div>
      </div>

      <div class="callout callout-amber" style="margin-bottom:16px;">
        <strong>Talent user ↔ Talent record.</strong> A Talent record can exist without a portal user account — the Agency creates talent profiles independently of portal access. When portal access is toggled on, a User record is created with role=TALENT and talentId pointing to the existing Talent record. Toggling off sets user.active = false — the talent profile itself is unaffected.
      </div>

      <div class="mono-label" style="margin-top:20px;">Flow C · Agent / Finance User (Agency Admin-initiated)</div>
      <div style="overflow-x:auto;">
        <div class="flow" style="min-width:480px;">
          <div class="flow-node"><div class="fn-box fn-blue">Agency Admin invites user<div class="fn-sub">Email + role selection</div></div><div class="fn-label">Settings → Team</div></div>
          <div class="flow-arrow blue"><div class="line"></div><div class="head"></div></div>
          <div class="flow-node"><div class="fn-box fn-amber">Invite email sent<div class="fn-sub">Magic link · 24hr</div></div><div class="fn-label">User record created<br>active = false</div></div>
          <div class="flow-arrow amber"><div class="line"></div><div class="head"></div></div>
          <div class="flow-node"><div class="fn-box fn-teal">User accepts invite<div class="fn-sub">Sets password · active = true</div></div><div class="fn-label">Routes to role portal</div></div>
        </div>
      </div>
    </div>

  </div>

</div></div>


<div class="sec-head"><div class="wrap"><div class="sec-head-inner">
  <span class="sec-num">04</span>
  <div><div class="sec-title">Xero Connect</div><div class="sec-sub">OAuth 2.0 flow · what syncs · webhook setup · testing checklist</div></div>
  <span class="sec-badge" style="background:var(--teal-dim);color:#5EEAD4;border:1px solid rgba(20,184,166,0.3);">Integration</span>
</div></div></div>

<div class="sec-body"><div class="wrap">

  <div class="callout callout-teal" style="margin-bottom:28px;">
    <strong>One Xero connection per agency.</strong> Each agency connects their own Xero organisation via OAuth. Therum stores the xeroTenantId and access/refresh tokens against the Agency record. Tokens are refreshed automatically before expiry. If a token refresh fails, the agency sees a "Reconnect Xero" banner — no silent failures.
  </div>

  <div class="mono-label" style="margin-bottom:16px;">OAuth 2.0 Connect Flow</div>
  <div style="overflow-x:auto;margin-bottom:28px;">
    <div class="flow" style="min-width:900px;">
      <div class="flow-node"><div class="fn-box fn-blue">Agency Admin clicks "Connect Xero"<div class="fn-sub">Settings or wizard</div></div><div class="fn-label">Therum initiates OAuth</div></div>
      <div class="flow-arrow teal"><div class="line"></div><div class="head"></div></div>
      <div class="flow-node"><div class="fn-box fn-teal">Redirect to Xero<div class="fn-sub">xero.com/oauth/authorize</div></div><div class="fn-label">User logs into Xero<br>selects organisation</div></div>
      <div class="flow-arrow teal"><div class="line"></div><div class="head"></div></div>
      <div class="flow-node"><div class="fn-box fn-teal">Xero redirects back<div class="fn-sub">?code=AUTH_CODE</div></div><div class="fn-label">Callback URL:<br>/xero/callback</div></div>
      <div class="flow-arrow teal"><div class="line"></div><div class="head"></div></div>
      <div class="flow-node"><div class="fn-box fn-navy">Therum exchanges code<div class="fn-sub">For access + refresh tokens</div></div><div class="fn-label">POST /token<br>Store securely</div></div>
      <div class="flow-arrow teal"><div class="line"></div><div class="head"></div></div>
      <div class="flow-node"><div class="fn-box fn-navy">Fetch tenants<div class="fn-sub">GET /connections</div></div><div class="fn-label">Store xeroTenantId<br>against Agency</div></div>
      <div class="flow-arrow green"><div class="line"></div><div class="head"></div></div>
      <div class="flow-node"><div class="fn-box fn-green">Connected ✓<div class="fn-sub">Status shown in settings</div></div><div class="fn-label">Register webhook<br>subscription</div></div>
    </div>
  </div>

  <div class="g2" style="margin-bottom:28px;">

    <div class="card">
      <div class="card-head" style="background:var(--teal-dim);border-color:rgba(20,184,166,0.2);">
        <div class="card-head-title" style="color:var(--teal);">What Therum Does in Xero</div>
      </div>
      <div class="card-body" style="padding:0;">
        <div class="data-section-header">Reads from Xero</div>
        <div class="step-list" style="padding:0 16px;">
          <div class="step"><div class="step-num" style="background:var(--teal-dim);color:var(--teal);">R</div><div class="step-content"><div class="step-title">GET /Contacts</div><div class="step-desc">On connect and on-demand sync. Matches existing contacts to Therum Client/Talent records by email. Stores xeroContactId to prevent duplicates.</div></div></div>
          <div class="step" style="border:none;"><div class="step-num" style="background:var(--teal-dim);color:var(--teal);">R</div><div class="step-content"><div class="step-title">GET /Invoices (webhook-triggered)</div><div class="step-desc">On webhook event (invoice status change). Reads updated status and syncs to Therum. Therum does not poll — all status updates are event-driven.</div></div></div>
        </div>
        <div class="data-section-header">Writes to Xero</div>
        <div class="step-list" style="padding:0 16px;">
          <div class="step"><div class="step-num" style="background:var(--blue-dim);color:var(--blue-lt);">W</div><div class="step-content"><div class="step-title">POST /Contacts</div><div class="step-desc">Creates new Client (IsCustomer) or Talent (IsSupplier) contact in Xero when first deal is created. Only if no matching contact already exists.</div></div></div>
          <div class="step"><div class="step-num" style="background:var(--blue-dim);color:var(--blue-lt);">W</div><div class="step-content"><div class="step-title">POST /Invoices (INV / SBI / COM)</div><div class="step-desc">On Finance Portal approval. All three invoices created atomically in a single batch. Xero IDs stored on InvoiceTriplet.</div></div></div>
          <div class="step" style="border:none;"><div class="step-num" style="background:var(--blue-dim);color:var(--blue-lt);">W</div><div class="step-content"><div class="step-title">POST /CreditNotes (MCN)</div><div class="step-desc">When Finance raises a ManualCreditNote. Pushed with MCN-XXXX reference. xeroCnId stored.</div></div></div>
        </div>
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:16px;">

      <div class="card">
        <div class="card-head" style="background:var(--teal-dim);border-color:rgba(20,184,166,0.2);">
          <div class="card-head-title" style="color:var(--teal);">Webhook Setup</div>
        </div>
        <div class="card-body" style="padding:0 16px;">
          <div class="step-list">
            <div class="step"><div class="step-num" style="background:var(--teal-dim);color:var(--teal);">1</div><div class="step-content"><div class="step-title">Register webhook on connect</div><div class="step-desc">POST /Webhooks with endpoint <span style="font-family:var(--mono);font-size:10px;">/webhooks/xero/{agencyId}</span>. Subscribe to: <span style="font-family:var(--mono);font-size:10px;">INVOICE</span> events only.</div></div></div>
            <div class="step"><div class="step-num" style="background:var(--teal-dim);color:var(--teal);">2</div><div class="step-content"><div class="step-title">Xero sends intent-to-receive ping</div><div class="step-desc">Xero sends a validation POST. Respond with the exact payload body and HTTP 200 within 5 seconds. If this fails, webhook is not activated.</div></div></div>
            <div class="step"><div class="step-num" style="background:var(--teal-dim);color:var(--teal);">3</div><div class="step-content"><div class="step-title">On INV status change</div><div class="step-desc">Webhook fires. Verify HMAC signature. Fetch updated invoice status. If status = PAID: set milestone.status = PAID, payout eligibility flag = true, Finance Portal queue updated.</div></div></div>
            <div class="step" style="border:none;"><div class="step-num" style="background:var(--teal-dim);color:var(--teal);">4</div><div class="step-content"><div class="step-title">Webhook delivery failure</div><div class="step-desc">If Therum returns non-200, Xero retries. Log all webhook events (received, signature valid, processed, failed) per agencyId. Admin panel shows last webhook received timestamp.</div></div></div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head" style="background:rgba(245,158,11,0.1);border-color:rgba(245,158,11,0.2);">
          <div class="card-head-title" style="color:var(--amber);">Token Management</div>
        </div>
        <div class="card-body" style="font-size:11px;color:var(--text-2);line-height:1.8;">
          <div style="margin-bottom:8px;">Access tokens expire after <strong style="color:var(--text);">30 minutes</strong>. Refresh tokens expire after <strong style="color:var(--text);">60 days</strong> (or on use).</div>
          <div style="margin-bottom:8px;">Before every Xero API call: check if access token expires within 5 minutes. If so, refresh first, then proceed.</div>
          <div style="margin-bottom:8px;">If refresh token is expired or revoked: set agency.xeroConnected = false, show reconnect banner to Agency Admin. Do not silently fail.</div>
          <div>Store tokens encrypted at rest. Never expose them in client-side responses.</div>
        </div>
      </div>

    </div>
  </div>

  <div class="mono-label">Xero Status — Admin Panel View</div>
  <div class="card" style="margin-bottom:0;">
    <div class="card-body" style="padding:0;">
      <div style="display:grid;grid-template-columns:180px 120px 120px 1fr;gap:0;padding:8px 16px 6px;font-family:var(--mono);font-size:9px;color:var(--text-3);letter-spacing:1px;text-transform:uppercase;border-bottom:1px solid var(--border);">
        <div>Agency</div><div>Status</div><div>Last webhook</div><div>Actions</div>
      </div>
      <div style="display:grid;grid-template-columns:180px 120px 120px 1fr;gap:0;padding:9px 16px;border-bottom:1px solid var(--border);align-items:center;">
        <div style="font-size:11px;color:var(--text);">OTG</div>
        <div><span style="font-family:var(--mono);font-size:9px;padding:2px 7px;background:var(--green-dim);color:var(--green);border-radius:3px;border:1px solid rgba(16,185,129,0.3);">CONNECTED</span></div>
        <div style="font-family:var(--mono);font-size:10px;color:var(--text-2);">2 min ago</div>
        <div style="font-size:11px;color:var(--text-3);">Re-sync contacts · View webhook log</div>
      </div>
      <div style="display:grid;grid-template-columns:180px 120px 120px 1fr;gap:0;padding:9px 16px;align-items:center;background:rgba(255,255,255,0.02);">
        <div style="font-size:11px;color:var(--text);">District</div>
        <div><span style="font-family:var(--mono);font-size:9px;padding:2px 7px;background:var(--amber-dim);color:var(--amber);border-radius:3px;border:1px solid rgba(245,158,11,0.3);">NOT CONNECTED</span></div>
        <div style="font-family:var(--mono);font-size:10px;color:var(--text-3);">—</div>
        <div style="font-size:11px;color:var(--text-3);">Send reconnect prompt to Agency Admin</div>
      </div>
    </div>
  </div>

</div></div>


<div class="sec-head"><div class="wrap"><div class="sec-head-inner">
  <span class="sec-num">05</span>
  <div><div class="sec-title">Payout Centre & Export</div><div class="sec-sub">Manual bank transfer flow · remittance PDF · bank transfer CSV</div></div>
  <span class="sec-badge" style="background:var(--green-dim);color:var(--green);border:1px solid rgba(16,185,129,0.3);">Finance Portal</span>
</div></div></div>

<div class="sec-body"><div class="wrap">

  <div class="callout callout-green" style="margin-bottom:28px;">
    <strong>MVP payout model: manual bank transfer.</strong> Stripe Connect payouts are deferred. The Payout Centre generates the calculation and documentation — the actual bank transfer is initiated manually by the Finance user outside Therum (via their own banking app). Therum's job is to tell them exactly how much to send to whom, and to generate the remittance PDF to send to the talent.
  </div>

  <div class="mono-label" style="margin-bottom:16px;">Payout Centre Flow</div>
  <div style="overflow-x:auto;margin-bottom:28px;">
    <div class="flow" style="min-width:900px;">
      <div class="flow-node"><div class="fn-box fn-teal">INV marked PAID in Xero<div class="fn-sub">Webhook fires</div></div><div class="fn-label">milestone.status = PAID<br>payoutEligible = true</div></div>
      <div class="flow-arrow green"><div class="line"></div><div class="head"></div></div>
      <div class="flow-node"><div class="fn-box fn-green">Appears in Payout Queue<div class="fn-sub">Finance Portal</div></div><div class="fn-label">Shows talent name<br>gross · commission · net</div></div>
      <div class="flow-arrow green"><div class="line"></div><div class="head"></div></div>
      <div class="flow-node"><div class="fn-box fn-navy">Finance reviews batch<div class="fn-sub">Selects which milestones to include</div></div><div class="fn-label">Can run partial batch<br>or select all</div></div>
      <div class="flow-arrow green"><div class="line"></div><div class="head"></div></div>
      <div class="flow-node"><div class="fn-box fn-amber">Finance confirms payout run<div class="fn-sub">One-click approval</div></div><div class="fn-label">PayoutRun record created<br>status = CONFIRMED</div></div>
      <div class="flow-arrow green"><div class="line"></div><div class="head"></div></div>
      <div class="flow-node"><div class="fn-box fn-green">Exports generated<div class="fn-sub">PDF remittances + CSV</div></div><div class="fn-label">Downloads available<br>immediately</div></div>
      <div class="flow-arrow green"><div class="line"></div><div class="head"></div></div>
      <div class="flow-node"><div class="fn-box fn-green">Finance transfers manually<div class="fn-sub">Using CSV as reference</div></div><div class="fn-label">Marks run as PAID<br>in Therum</div></div>
    </div>
  </div>

  <div class="g2" style="margin-bottom:28px;">

    <div class="card">
      <div class="card-head" style="background:var(--green-dim);border-color:rgba(16,185,129,0.2);">
        <div class="card-head-title" style="color:var(--green);">Remittance PDF — Per Talent</div>
        <span style="font-family:var(--mono);font-size:9px;color:var(--green);opacity:0.7;">One PDF per talent per payout run</span>
      </div>
      <div class="card-body" style="padding:16px;">
        <div style="margin-bottom:10px;font-size:11px;color:var(--text-2);line-height:1.65;">Generated on payout run confirmation. Sent to talent via email AND available for download in Talent Portal.</div>
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:5px;padding:14px 16px;margin-bottom:12px;">
          <div class="pdf-field"><span class="pdf-field-name">Agency name + logo</span><span class="pdf-field-desc">Agency branding at top of document</span></div>
          <div class="pdf-field"><span class="pdf-field-name">Remittance date</span><span class="pdf-field-desc">Date of payout run confirmation</span></div>
          <div class="pdf-field"><span class="pdf-field-name">Talent name</span><span class="pdf-field-desc">From talent.name</span></div>
          <div class="pdf-field"><span class="pdf-field-name">Payout run reference</span><span class="pdf-field-desc">PR-XXXX series. Unique per run.</span></div>
          <div class="pdf-field"><span class="pdf-field-name">Milestone rows</span><span class="pdf-field-desc">Per milestone included in this run: deal title · milestone description · SBI ref · gross amount</span></div>
          <div class="pdf-field"><span class="pdf-field-name">Gross total</span><span class="pdf-field-desc">Sum of all SBI amounts in this run</span></div>
          <div class="pdf-field"><span class="pdf-field-name">Less: commission</span><span class="pdf-field-desc">Sum of COM amounts · rate shown per row</span></div>
          <div class="pdf-field"><span class="pdf-field-name">Less: approved expenses</span><span class="pdf-field-desc">Non-rechargeable talent expenses deducted. Itemised per expense.</span></div>
          <div class="pdf-field" style="border-bottom:none;"><span class="pdf-field-name" style="color:var(--green);font-weight:700;">Net amount payable</span><span class="pdf-field-desc" style="color:var(--text);font-weight:600;">The exact amount to transfer. Highlighted.</span></div>
        </div>
        <div style="font-size:10px;color:var(--text-3);font-family:var(--mono);">Filename: therum-remittance-[talent-name]-[PR-ref].pdf</div>
      </div>
    </div>

    <div class="card">
      <div class="card-head" style="background:var(--teal-dim);border-color:rgba(20,184,166,0.2);">
        <div class="card-head-title" style="color:var(--teal);">Bank Transfer CSV — Per Payout Run</div>
        <span style="font-family:var(--mono);font-size:9px;color:var(--teal);opacity:0.7;">One CSV per payout run · all talent on one sheet</span>
      </div>
      <div class="card-body" style="padding:16px;">
        <div style="margin-bottom:10px;font-size:11px;color:var(--text-2);line-height:1.65;">Structured for bulk upload into most UK business banking platforms (Barclays, HSBC, NatWest, Lloyds). Finance downloads once, uploads to their bank.</div>
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:5px;padding:14px 16px;margin-bottom:12px;">
          <div class="pdf-field"><span class="pdf-field-name">talent_name</span><span class="pdf-field-desc">talent.name</span></div>
          <div class="pdf-field"><span class="pdf-field-name">bank_account_name</span><span class="pdf-field-desc">talent.bankAccountName (set on talent profile)</span></div>
          <div class="pdf-field"><span class="pdf-field-name">sort_code</span><span class="pdf-field-desc">talent.sortCode — stored on talent record</span></div>
          <div class="pdf-field"><span class="pdf-field-name">account_number</span><span class="pdf-field-desc">talent.accountNumber — stored on talent record</span></div>
          <div class="pdf-field"><span class="pdf-field-name">amount</span><span class="pdf-field-desc">Net payout amount (2dp, no £ symbol)</span></div>
          <div class="pdf-field"><span class="pdf-field-name">reference</span><span class="pdf-field-desc">Payout run reference (PR-XXXX) — appears on talent's bank statement</span></div>
          <div class="pdf-field" style="border-bottom:none;"><span class="pdf-field-name">payment_date</span><span class="pdf-field-desc">Date of payout run confirmation</span></div>
        </div>
        <div style="font-size:10px;color:var(--text-3);font-family:var(--mono);">Filename: therum-payouts-[PR-ref]-[date].csv</div>
        <div style="margin-top:10px;padding:8px 10px;background:var(--amber-dim);border:1px solid rgba(245,158,11,0.3);border-radius:4px;font-size:10px;color:var(--amber);line-height:1.6;">⚠ Bank details (sort code, account number) must be collected from talent during onboarding or profile setup. Add sort_code and account_number fields to the Talent entity.</div>
      </div>
    </div>

  </div>

  <div class="mono-label">PayoutRun Entity</div>
  <div style="border-radius:8px;overflow:hidden;border:1px solid var(--border);margin-bottom:28px;">
    <div class="data-row pk"><span class="field">id</span><span class="type">UUID</span><span class="note">Primary key</span></div>
    <div class="data-row"><span class="field">agencyId</span><span class="type">UUID</span><span class="note">→ Agency</span></div>
    <div class="data-row"><span class="field">reference</span><span class="type">String</span><span class="note">PR-XXXX series. Auto-incremented per agency. Appears on bank transfer reference and remittance PDFs.</span></div>
    <div class="data-row"><span class="field">milestoneIds</span><span class="type">UUID[]</span><span class="note">Array of milestone IDs included in this run. All must have status = PAID at run confirmation.</span></div>
    <div class="data-row"><span class="field">totalGross</span><span class="type">Decimal</span><span class="note">Sum of all SBI amounts included</span></div>
    <div class="data-row"><span class="field">totalCommission</span><span class="type">Decimal</span><span class="note">Sum of all COM amounts included</span></div>
    <div class="data-row"><span class="field">totalNet</span><span class="type">Decimal</span><span class="note">totalGross − totalCommission − totalExpenses. The amount to be transferred in total.</span></div>
    <div class="data-row enum"><span class="field">status</span><span class="type">Enum</span><span class="note">DRAFT | CONFIRMED | PAID. DRAFT = in review. CONFIRMED = approved, exports available. PAID = Finance has confirmed manual transfer made.</span></div>
    <div class="data-row"><span class="field">confirmedBy</span><span class="type">String?</span><span class="note">User ID of Finance user who confirmed the run</span></div>
    <div class="data-row"><span class="field">confirmedAt</span><span class="type">DateTime?</span><span class="note">Timestamp of run confirmation</span></div>
    <div class="data-row"><span class="field">paidAt</span><span class="type">DateTime?</span><span class="note">Timestamp when Finance marks the run as PAID (manually transferred)</span></div>
    <div class="data-row"><span class="field">remittancePdfUrl</span><span class="type">String?</span><span class="note">Storage URL for generated PDF bundle (one per talent, zipped). Set on confirmation.</span></div>
    <div class="data-row" style="border-bottom:none;"><span class="field">bankTransferCsvUrl</span><span class="type">String?</span><span class="note">Storage URL for CSV export. Set on confirmation.</span></div>
  </div>

  <div class="mono-label">Additional Fields Required on Talent — Bank Details</div>
  <div class="callout callout-amber" style="margin-bottom:16px;">
    These fields need to be added to the Talent entity and collected during talent profile setup or onboarding. Without them the CSV export cannot be generated. Make them required before a payout run can include that talent.
  </div>
  <div style="border-radius:8px;overflow:hidden;border:1px solid var(--border);">
    <div class="data-row"><span class="field">bankAccountName</span><span class="type">String?</span><span class="note">Account name as it appears on the bank account. Required for CSV export.</span></div>
    <div class="data-row"><span class="field">sortCode</span><span class="type">String?</span><span class="note">6-digit UK sort code (stored without dashes, e.g. 040004). Required for CSV export.</span></div>
    <div class="data-row" style="border-bottom:none;"><span class="field">accountNumber</span><span class="type">String?</span><span class="note">8-digit UK account number. Required for CSV export. Store encrypted at rest.</span></div>
  </div>

</div></div>


<div class="sec-head"><div class="wrap"><div class="sec-head-inner">
  <span class="sec-num">06</span>
  <div><div class="sec-title">Beta Testing Checklist</div><div class="sec-sub">What to verify end-to-end before handing to a design partner</div></div>
  <span class="sec-badge" style="background:var(--purple-dim);color:#C4B5FD;border:1px solid rgba(139,92,246,0.3);">QA</span>
</div></div></div>

<div class="sec-body"><div class="wrap">

  <div class="g3">

    <div class="card">
      <div class="card-head" style="background:var(--blue-dim);border-color:rgba(30,85,204,0.2);">
        <div class="card-head-title" style="color:var(--blue-lt);">Access & Users</div>
      </div>
      <div class="card-body" style="padding:0 16px;">
        <div class="step-list">
          <div class="step"><div class="step-num" style="background:var(--green-dim);color:var(--green);">✓</div><div class="step-content"><div class="step-desc">Bhav can log in at /admin with Super Admin credentials</div></div></div>
          <div class="step"><div class="step-num" style="background:var(--green-dim);color:var(--green);">✓</div><div class="step-content"><div class="step-desc">Create a test agency from admin panel — invite email received</div></div></div>
          <div class="step"><div class="step-num" style="background:var(--green-dim);color:var(--green);">✓</div><div class="step-content"><div class="step-desc">Agency Admin accepts invite, sets password, reaches /agency/pipeline</div></div></div>
          <div class="step"><div class="step-num" style="background:var(--green-dim);color:var(--green);">✓</div><div class="step-content"><div class="step-desc">Agency Admin invites Agent → Agent logs in, sees only own deals</div></div></div>
          <div class="step"><div class="step-num" style="background:var(--green-dim);color:var(--green);">✓</div><div class="step-content"><div class="step-desc">Agency Admin invites Finance user → Finance logs in at /finance/invoices</div></div></div>
          <div class="step"><div class="step-num" style="background:var(--green-dim);color:var(--green);">✓</div><div class="step-content"><div class="step-desc">Toggle talent portal access → talent receives invite, logs in at /talent/deals</div></div></div>
          <div class="step" style="border:none;"><div class="step-num" style="background:var(--green-dim);color:var(--green);">✓</div><div class="step-content"><div class="step-desc">Suspended user cannot log in. Reactivated user can.</div></div></div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head" style="background:var(--teal-dim);border-color:rgba(20,184,166,0.2);">
        <div class="card-head-title" style="color:var(--teal);">Xero Connect</div>
      </div>
      <div class="card-body" style="padding:0 16px;">
        <div class="step-list">
          <div class="step"><div class="step-num" style="background:var(--green-dim);color:var(--green);">✓</div><div class="step-content"><div class="step-desc">OAuth button in Settings redirects to Xero login</div></div></div>
          <div class="step"><div class="step-num" style="background:var(--green-dim);color:var(--green);">✓</div><div class="step-content"><div class="step-desc">After Xero auth, returns to Therum with "Connected" status</div></div></div>
          <div class="step"><div class="step-num" style="background:var(--green-dim);color:var(--green);">✓</div><div class="step-content"><div class="step-desc">xeroTenantId stored against agency record</div></div></div>
          <div class="step"><div class="step-num" style="background:var(--green-dim);color:var(--green);">✓</div><div class="step-content"><div class="step-desc">Xero contacts sync — existing clients/talent matched by email</div></div></div>
          <div class="step"><div class="step-num" style="background:var(--green-dim);color:var(--green);">✓</div><div class="step-content"><div class="step-desc">Finance approves invoice → INV + SBI + COM appear in Xero</div></div></div>
          <div class="step"><div class="step-num" style="background:var(--green-dim);color:var(--green);">✓</div><div class="step-content"><div class="step-desc">Mark INV PAID in Xero → webhook fires → Therum updates milestone status</div></div></div>
          <div class="step" style="border:none;"><div class="step-num" style="background:var(--green-dim);color:var(--green);">✓</div><div class="step-content"><div class="step-desc">Admin panel shows correct Xero status and last webhook timestamp per agency</div></div></div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head" style="background:var(--green-dim);border-color:rgba(16,185,129,0.2);">
        <div class="card-head-title" style="color:var(--green);">Payout Export</div>
      </div>
      <div class="card-body" style="padding:0 16px;">
        <div class="step-list">
          <div class="step"><div class="step-num" style="background:var(--green-dim);color:var(--green);">✓</div><div class="step-content"><div class="step-desc">Paid milestone appears in Finance Portal payout queue</div></div></div>
          <div class="step"><div class="step-num" style="background:var(--green-dim);color:var(--green);">✓</div><div class="step-content"><div class="step-desc">Payout queue shows gross, commission, net per milestone</div></div></div>
          <div class="step"><div class="step-num" style="background:var(--green-dim);color:var(--green);">✓</div><div class="step-content"><div class="step-desc">Finance confirms payout run — PayoutRun record created</div></div></div>
          <div class="step"><div class="step-num" style="background:var(--green-dim);color:var(--green);">✓</div><div class="step-content"><div class="step-desc">Remittance PDF downloads correctly — correct amounts, correct talent name, PR reference</div></div></div>
          <div class="step"><div class="step-num" style="background:var(--green-dim);color:var(--green);">✓</div><div class="step-content"><div class="step-desc">Bank transfer CSV downloads with correct columns and amounts</div></div></div>
          <div class="step"><div class="step-num" style="background:var(--green-dim);color:var(--green);">✓</div><div class="step-content"><div class="step-desc">Talent can download their remittance PDF from /talent portal</div></div></div>
          <div class="step" style="border:none;"><div class="step-num" style="background:var(--green-dim);color:var(--green);">✓</div><div class="step-content"><div class="step-desc">Finance marks run PAID → deal card advances to COMPLETE</div></div></div>
        </div>
      </div>
    </div>

  </div>

</div></div>




<div class="sec-head"><div class="wrap"><div class="sec-head-inner">
  <span class="sec-num">07</span>
  <div><div class="sec-title">Preview as Talent</div><div class="sec-sub">Agency users view the Talent Portal as a specific talent · no separate login required</div></div>
  <span class="sec-badge" style="background:var(--purple-dim);color:#C4B5FD;border:1px solid rgba(139,92,246,0.3);">QA / Beta</span>
</div></div></div>

<div class="sec-body"><div class="wrap">

  <div class="callout callout-blue" style="margin-bottom:28px;">
    <strong>No separate credentials needed.</strong> Agency Admin and Agent users can preview exactly what a specific talent sees in their portal, within their existing session. This is the primary QA mechanism for the beta — and has ongoing value as agents can show a talent what their portal looks like before sending the invite.
  </div>

  <div class="mono-label" style="margin-bottom:16px;">Preview Flow</div>
  <div style="overflow-x:auto;margin-bottom:28px;">
    <div class="flow" style="min-width:820px;">
      <div class="flow-node"><div class="fn-box fn-blue">Agent opens talent profile<div class="fn-sub">Roster → talent detail</div></div><div class="fn-label">Agency Portal</div></div>
      <div class="flow-arrow blue"><div class="line"></div><div class="head"></div></div>
      <div class="flow-node"><div class="fn-box fn-navy">Clicks "Preview Portal"<div class="fn-sub">Button on talent profile</div></div><div class="fn-label">Available to AGENCY_ADMIN<br>and AGENT roles</div></div>
      <div class="flow-arrow blue"><div class="line"></div><div class="head"></div></div>
      <div class="flow-node"><div class="fn-box fn-purple">Opens /talent/preview/{talentId}<div class="fn-sub">New browser tab</div></div><div class="fn-label">Auth-gated to existing session<br>no new login required</div></div>
      <div class="flow-arrow"><div class="line"></div><div class="head"></div></div>
      <div class="flow-node"><div class="fn-box fn-purple">Preview banner shown<div class="fn-sub">"Previewing as [name]"</div></div><div class="fn-label">Read-only · no actions<br>Exit Preview button</div></div>
      <div class="flow-arrow"><div class="line"></div><div class="head"></div></div>
      <div class="flow-node"><div class="fn-box fn-navy">Exit Preview<div class="fn-sub">Click banner button</div></div><div class="fn-label">Closes tab / returns to<br>talent profile page</div></div>
    </div>
  </div>

  <div class="g2" style="margin-bottom:24px;">

    <div class="card">
      <div class="card-head" style="background:var(--purple-dim);border-color:rgba(139,92,246,0.2);">
        <div class="card-head-title" style="color:#C4B5FD;">Route & Auth Spec</div>
      </div>
      <div class="card-body" style="padding:0 16px;">
        <div class="step-list">
          <div class="step">
            <div class="step-num" style="background:var(--blue-dim);color:var(--blue-lt);">1</div>
            <div class="step-content">
              <div class="step-title">Route</div>
              <div class="step-desc"><span style="font-family:var(--mono);font-size:10px;">GET /talent/preview/:talentId</span> — protected route. Requires valid session. Role must be SUPER_ADMIN, AGENCY_ADMIN, or AGENT.</div>
            </div>
          </div>
          <div class="step">
            <div class="step-num" style="background:var(--blue-dim);color:var(--blue-lt);">2</div>
            <div class="step-content">
              <div class="step-title">Agency scope check</div>
              <div class="step-desc">Verify the talentId belongs to the same agencyId as the requesting user. An agent from Agency A cannot preview a talent from Agency B. Reject with 403 if mismatch.</div>
            </div>
          </div>
          <div class="step">
            <div class="step-num" style="background:var(--blue-dim);color:var(--blue-lt);">3</div>
            <div class="step-content">
              <div class="step-title">Render Talent Portal</div>
              <div class="step-desc">Load the full Talent Portal view scoped to the given talentId — exactly what the talent would see. All data is live and real, not a mockup.</div>
            </div>
          </div>
          <div class="step">
            <div class="step-num" style="background:var(--amber-dim);color:var(--amber);">4</div>
            <div class="step-content">
              <div class="step-title">Read-only enforcement</div>
              <div class="step-desc">All interactive elements in the Talent Portal are disabled in preview mode. No form submissions, no downloads that would trigger actions. Remittance PDFs are viewable but any "confirm" or "submit" buttons are hidden.</div>
            </div>
          </div>
          <div class="step" style="border:none;">
            <div class="step-num" style="background:var(--green-dim);color:var(--green);">5</div>
            <div class="step-content">
              <div class="step-title">Audit log</div>
              <div class="step-desc">Log every preview session: previewedBy (userId), talentId, agencyId, startedAt. No end timestamp needed — each page load is a discrete event.</div>
              <div class="step-code">PreviewLog { id, previewedBy, talentId, agencyId, startedAt }</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head" style="background:var(--purple-dim);border-color:rgba(139,92,246,0.2);">
        <div class="card-head-title" style="color:#C4B5FD;">Preview Banner — UI Spec</div>
      </div>
      <div class="card-body">
        <div style="background:rgba(139,92,246,0.2);border:1.5px solid rgba(139,92,246,0.5);border-radius:6px;padding:10px 16px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;">
          <div style="font-size:11px;color:#C4B5FD;"><strong style="color:#fff;">Previewing portal as Maya Thornton</strong> — this is a read-only view. Changes cannot be made.</div>
          <div style="font-family:var(--mono);font-size:9px;color:#C4B5FD;padding:4px 10px;border:1px solid rgba(139,92,246,0.5);border-radius:4px;cursor:pointer;flex-shrink:0;margin-left:16px;">Exit Preview</div>
        </div>
        <div style="font-size:11px;color:var(--text-2);line-height:1.75;">
          <div style="margin-bottom:8px;">Banner is <strong style="color:var(--text);">sticky at the top</strong> of the page — always visible regardless of scroll position. Cannot be dismissed.</div>
          <div style="margin-bottom:8px;">Colour: purple background to clearly distinguish from the actual Talent Portal which uses no purple in its nav. Unambiguous that this is a preview state.</div>
          <div style="margin-bottom:8px;">The talent's name is shown so the agent always knows whose view they're looking at — relevant when previewing multiple talent in quick succession.</div>
          <div><strong style="color:var(--text);">Exit Preview</strong> button closes the tab if opened via window.open(), or navigates back to the talent profile page if in the same tab.</div>
        </div>
      </div>
    </div>

  </div>

  <div class="callout callout-amber" style="margin-bottom:0;">
    <strong>Beta QA usage.</strong> During beta testing, Bhav and the agency users should run through the full deal-to-payout flow end-to-end, then use Preview as Talent at each stage to verify: milestones appear correctly, payout schedule shows the right amounts, remittance PDF downloads and shows correct figures. This validates all three portals in a single session without any role switching.
  </div>

</div></div>


<div class="sec-head"><div class="wrap"><div class="sec-head-inner">
  <span class="sec-num">08</span>
  <div><div class="sec-title">Agency Portal</div><div class="sec-sub">All screens · deal creation flow · milestone & deliverable management · stage transitions</div></div>
  <span class="sec-badge" style="background:var(--blue-dim);color:#93C5FD;border:1px solid rgba(30,85,204,0.4);">Agency Portal</span>
</div></div></div>

<div class="sec-body"><div class="wrap">

  <div class="mono-label">Sidebar Navigation (Persistent)</div>
  <div style="margin-bottom:14px;font-size:11px;color:var(--text-2);line-height:1.7;">These are persistent sidebar navigation items across the session, not standalone screens.</div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:32px;">
    <div style="background:var(--surface);border:1px solid rgba(30,85,204,0.3);border-radius:6px;padding:12px 14px;">
      <div style="font-family:var(--mono);font-size:9px;color:var(--blue-lt);font-weight:700;margin-bottom:8px;">PIPELINE</div>
      <div style="font-size:10px;color:var(--text-2);line-height:1.7;">/agency/pipeline<br>View Toggle: Kanban / Table<br>Deal cards + milestone chips<br>KPI cards above board</div>
    </div>
    <div style="background:var(--surface);border:1px solid rgba(30,85,204,0.3);border-radius:6px;padding:12px 14px;">
      <div style="font-family:var(--mono);font-size:9px;color:var(--blue-lt);font-weight:700;margin-bottom:8px;">DEAL DETAIL</div>
      <div style="font-size:10px;color:var(--text-2);line-height:1.7;">/agency/deals/:dealId<br>Full deal view · milestones<br>Deliverables · expenses · notes<br>Stage controls + readiness gate</div>
    </div>
    <div style="background:var(--surface);border:1px solid rgba(30,85,204,0.3);border-radius:6px;padding:12px 14px;">
      <div style="font-family:var(--mono);font-size:9px;color:var(--blue-lt);font-weight:700;margin-bottom:8px;">ROSTER</div>
      <div style="font-size:10px;color:var(--text-2);line-height:1.7;">/agency/roster<br>All talent · profile pages<br>Bank details · VAT status<br>Portal access toggle · Preview</div>
    </div>
    <div style="background:var(--surface);border:1px solid rgba(30,85,204,0.3);border-radius:6px;padding:12px 14px;">
      <div style="font-family:var(--mono);font-size:9px;color:var(--blue-lt);font-weight:700;margin-bottom:8px;">CLIENTS</div>
      <div style="font-size:10px;color:var(--text-2);line-height:1.7;">/agency/clients<br>Client records · contacts<br>PRIMARY + FINANCE + OTHER<br>Payment terms · Xero link</div>
    </div>
    <div style="background:var(--surface);border:1px solid rgba(245,158,11,0.3);border-radius:6px;padding:12px 14px;">
      <div style="font-family:var(--mono);font-size:9px;color:var(--amber);font-weight:700;margin-bottom:8px;">VAT MONITOR</div>
      <div style="font-size:10px;color:var(--text-2);line-height:1.7;">/agency/vat<br>Per-talent rolling 12-month SBI<br>Three-tier alerts<br>Projected breach date</div>
    </div>
    <div style="background:var(--surface);border:1px solid rgba(30,85,204,0.3);border-radius:6px;padding:12px 14px;">
      <div style="font-family:var(--mono);font-size:9px;color:var(--blue-lt);font-weight:700;margin-bottom:8px;">SETTINGS</div>
      <div style="font-size:10px;color:var(--text-2);line-height:1.7;">/agency/settings<br>Agency defaults · invoicing model<br>Team management · Xero connect<br>VAT registration</div>
    </div>
    <div style="background:var(--surface);border:1px solid rgba(16,185,129,0.3);border-radius:6px;padding:12px 14px;">
      <div style="font-family:var(--mono);font-size:9px;color:var(--green);font-weight:700;margin-bottom:8px;">COMPLETED DEALS</div>
      <div style="font-size:10px;color:var(--text-2);line-height:1.7;">/agency/deals/archive<br>All COMPLETE deals<br>Historical view · read-only<br>Filter by talent / client / date</div>
    </div>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:12px 14px;">
      <div style="font-family:var(--mono);font-size:9px;color:var(--text-3);font-weight:700;margin-bottom:8px;">DASHBOARD</div>
      <div style="font-size:10px;color:var(--text-2);line-height:1.7;">/agency/dashboard<br>6 KPI cards<br>Recent activity feed<br>VAT alerts banner</div>
    </div>
  </div>

  <div class="mono-label">Pipeline Screen — /agency/pipeline</div>
  <div class="card" style="margin-bottom:24px;">
    <div class="card-head"><div class="card-head-title">Kanban Board & Table Layout</div></div>
    <div class="card-body">
      <div style="margin-bottom:14px;font-size:11px;color:var(--text-2);line-height:1.7;">Features a Kanban / Table view toggle. The table view enables robust filtering (by talent, by stage, by client). In Kanban mode, six columns render left to right. Each column has a header showing the stage name, default probability, and count of deals in that column. Columns scroll vertically if many deals. Board scrolls horizontally on narrow screens.</div>
      <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-bottom:16px;">
        <div style="text-align:center;padding:7px 6px;border-radius:4px;background:rgba(100,116,139,0.12);border:1px solid rgba(100,116,139,0.2);"><div style="font-family:var(--mono);font-size:9px;font-weight:700;color:#94A3B8;">PROSPECT</div><div style="font-family:var(--mono);font-size:8px;color:var(--text-3);">10%</div></div>
        <div style="text-align:center;padding:7px 6px;border-radius:4px;background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.25);"><div style="font-family:var(--mono);font-size:9px;font-weight:700;color:#A5B4FC;">NEGOTIATING</div><div style="font-family:var(--mono);font-size:8px;color:var(--text-3);">40%</div></div>
        <div style="text-align:center;padding:7px 6px;border-radius:4px;background:var(--amber-dim);border:1px solid rgba(245,158,11,0.3);"><div style="font-family:var(--mono);font-size:9px;font-weight:700;color:var(--amber);">CONTRACTING</div><div style="font-family:var(--mono);font-size:8px;color:var(--text-3);">80%</div></div>
        <div style="text-align:center;padding:7px 6px;border-radius:4px;background:var(--blue-dim);border:1px solid rgba(30,85,204,0.3);"><div style="font-family:var(--mono);font-size:9px;font-weight:700;color:var(--blue-lt);">ACTIVE</div><div style="font-family:var(--mono);font-size:8px;color:var(--text-3);">100% · fields lock</div></div>
        <div style="text-align:center;padding:7px 6px;border-radius:4px;background:var(--teal-dim);border:1px solid rgba(20,184,166,0.3);"><div style="font-family:var(--mono);font-size:9px;font-weight:700;color:var(--teal);">IN BILLING</div><div style="font-family:var(--mono);font-size:8px;color:var(--text-3);">auto-set</div></div>
        <div style="text-align:center;padding:7px 6px;border-radius:4px;background:var(--green-dim);border:1px solid rgba(16,185,129,0.3);"><div style="font-family:var(--mono);font-size:9px;font-weight:700;color:var(--green);">COMPLETE</div><div style="font-family:var(--mono);font-size:8px;color:var(--text-3);">→ archive</div></div>
      </div>
      <div style="font-size:11px;color:var(--text-2);line-height:1.8;"><strong style="color:var(--text);">Deal card contains:</strong> deal title · client name · talent name · total value · weighted value (value × probability) · milestone progress bar (colour-coded chips per milestone) · stage badge. Clicking a card opens Deal Detail. Deal cards in PROSPECT/NEGOTIATING/CONTRACTING/ACTIVE can be dragged between those columns. IN BILLING and COMPLETE cards are not draggable — stage is system-controlled.</div>
    </div>
  </div>

  <div class="mono-label">New Deal Form</div>
  <div class="card" style="margin-bottom:24px;">
    <div class="card-head"><div class="card-head-title">Create Deal — Required Fields</div><span style="font-family:var(--mono);font-size:9px;color:var(--text-3);">POST /deals</span></div>
    <div class="card-body" style="padding:0;">
      <div class="data-section-header">Core (all required)</div>
      <div style="display:grid;grid-template-columns:200px 1fr;gap:0;">
        <div class="data-row"><span class="field">title</span><span class="note">Deal name — shown on Kanban card and in all invoice references</span></div>
        <div class="data-row"><span class="field">clientId</span><span class="note">Select from existing clients or create new inline. Must have at least one contact.</span></div>
        <div class="data-row"><span class="field">talentId</span><span class="note">Select from talent roster</span></div>
        <div class="data-row"><span class="field">totalValue</span><span class="note">Gross contract value. Sum of milestones must equal this.</span></div>
        <div class="data-row"><span class="field">commissionRate</span><span class="note">Defaults to talent.commissionRate. Overridable per deal.</span></div>
        <div class="data-row"><span class="field">paymentTermsDays</span><span class="note">Defaults to client.paymentTermsDays. Overridable per deal.</span></div>
        <div class="data-row enum" style="border-bottom:none;"><span class="field">stage</span><span class="note">Default: PROSPECT. Agent can select any pre-ACTIVE stage on creation.</span></div>
      </div>
      <div class="data-section-header">Optional on creation</div>
      <div style="display:grid;grid-template-columns:200px 1fr;gap:0;">
        <div class="data-row"><span class="field">probability</span><span class="note">Override default for the selected stage. 0–100 slider.</span></div>
        <div class="data-row" style="border-bottom:none;"><span class="field">notes</span><span class="note">Free-text deal notes. Private to agency — not visible to talent or finance.</span></div>
      </div>
    </div>
  </div>

  <div class="mono-label">Deal Detail Page — /agency/deals/:dealId</div>
  <div class="card" style="margin-bottom:24px;">
    <div class="card-head"><div class="card-head-title">Page Structure</div></div>
    <div class="card-body" style="padding:0;">
      <div class="step-list" style="padding:0 16px;">
        <div class="step">
          <div class="step-num" style="background:var(--navy);color:var(--blue-lt);">H</div>
          <div class="step-content">
            <div class="step-title">Deal Header</div>
            <div class="step-desc">Deal title (editable) · Client name · Talent name · Stage badge (colour-coded) · Total value · Weighted value · Commission rate · Invoicing model badge. Fields locked display only once ACTIVE+.</div>
          </div>
        </div>
        <div class="step">
          <div class="step-num" style="background:var(--blue-dim);color:var(--blue-lt);">1</div>
          <div class="step-content">
            <div class="step-title">Stage Controls</div>
            <div class="step-desc">"Advance to [next stage]" button. On CONTRACTING → ACTIVE: triggers readiness gate check before proceeding. On any pre-CONTRACTING stage: probability override input shown alongside. On IN BILLING / COMPLETE: no button — system-controlled, stage shown as read-only.</div>
          </div>
        </div>
        <div class="step">
          <div class="step-num" style="background:var(--teal-dim);color:var(--teal);">2</div>
          <div class="step-content">
            <div class="step-title">Milestones Panel</div>
            <div class="step-desc">List of all milestones. Each row: description · amount · invoice date · delivery due date · status chip · deliverable count (e.g. "3/3 approved"). "+ Add Milestone" button available until deal is IN BILLING. Clicking a milestone row expands to show its deliverables inline.</div>
          </div>
        </div>
        <div class="step">
          <div class="step-num" style="background:var(--teal-dim);color:var(--teal);">3</div>
          <div class="step-content">
            <div class="step-title">Deliverables (per milestone, inline expanded)</div>
            <div class="step-desc">Deliverable rows: title · due date · status badge (PENDING / SUBMITTED / APPROVED). Agent can mark PENDING → SUBMITTED → APPROVED. "+ Add Deliverable" on each milestone. Approved count shown on milestone row.</div>
          </div>
        </div>
        <div class="step">
          <div class="step-num" style="background:var(--amber-dim);color:var(--amber);">4</div>
          <div class="step-content">
            <div class="step-title">Expenses Panel</div>
            <div class="step-desc">List of deal expenses. Each row: description · category · amount · rechargeable badge · contractSignOff badge · status chip. "+ Add Expense" button. Agent submits; Finance approves from their portal. Approved expenses with rechargeable=true are flagged to appear on the next INV.</div>
          </div>
        </div>
        <div class="step">
          <div class="step-num" style="background:rgba(255,255,255,0.05);color:var(--text-2);">5</div>
          <div class="step-content">
            <div class="step-title">Notes</div>
            <div class="step-desc">Free-text area. Auto-saves on blur. Private to agency. Shows last edited timestamp. Not visible to Finance or Talent portals.</div>
          </div>
        </div>
        <div class="step" style="border:none;">
          <div class="step-num" style="background:rgba(255,255,255,0.05);color:var(--text-2);">6</div>
          <div class="step-content">
            <div class="step-title">Contract</div>
            <div class="step-desc">PDF upload area. Shows filename and upload date once attached. Required (warning) before CONTRACTING → ACTIVE transition. Replace button available pre-ACTIVE.</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="mono-label">Readiness Gate — CONTRACTING → ACTIVE Modal</div>
  <div class="card" style="margin-bottom:24px;">
    <div class="card-body">
      <div style="font-size:11px;color:var(--text-2);line-height:1.75;margin-bottom:14px;">When the agent clicks "Move to Active", run all checks server-side before displaying the modal. Return a checklist result array. Modal shows each check with ✓ (pass) / ✗ (block) / ⚠ (warn). Agent cannot confirm until all blocks are resolved. Warnings require explicit checkbox acknowledgement.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div>
          <div style="font-family:var(--mono);font-size:9px;color:var(--red);font-weight:700;margin-bottom:8px;letter-spacing:1px;text-transform:uppercase;">Hard Blocks (must resolve)</div>
          <div style="display:flex;flex-direction:column;gap:6px;font-size:11px;color:var(--text-2);line-height:1.6;">
            <div><span style="color:var(--red);">✗</span> Milestone amounts don't sum to deal total</div>
            <div><span style="color:var(--red);">✗</span> One or more milestones have no deliverables</div>
            <div><span style="color:var(--red);">✗</span> One or more milestones missing invoice date</div>
            <div><span style="color:var(--red);">✗</span> Talent not linked to a Xero contact</div>
            <div><span style="color:var(--red);">✗</span> Invoicing model not acknowledged</div>
          </div>
        </div>
        <div>
          <div style="font-family:var(--mono);font-size:9px;color:var(--amber);font-weight:700;margin-bottom:8px;letter-spacing:1px;text-transform:uppercase;">Warnings (explicit checkbox required)</div>
          <div style="display:flex;flex-direction:column;gap:6px;font-size:11px;color:var(--text-2);line-height:1.6;">
            <div><span style="color:var(--amber);">⚠</span> No FINANCE contact on client record</div>
            <div><span style="color:var(--amber);">⚠</span> No contract PDF uploaded</div>
            <div><span style="color:var(--amber);">⚠</span> VAT threshold will be approached by activating this deal</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="mono-label">Talent Roster — /agency/roster/:talentId</div>
  <div class="card" style="margin-bottom:0;">
    <div class="card-head"><div class="card-head-title">Talent Profile Page — Fields & Actions</div></div>
    <div class="card-body" style="padding:0;">
      <div class="data-section-header">Display fields</div>
      <div style="display:grid;grid-template-columns:200px 1fr;gap:0;">
        <div class="data-row"><span class="field">name · email</span><span class="note">Editable</span></div>
        <div class="data-row"><span class="field">commissionRate</span><span class="note">Default rate. Shown as % with edit button.</span></div>
        <div class="data-row flag"><span class="field">vatRegistered</span><span class="note">Toggle. If true: vatNumber field shown (required).</span></div>
        <div class="data-row"><span class="field">bankAccountName · sortCode · accountNumber</span><span class="note">Bank details for CSV payout export. Editable. accountNumber shown masked.</span></div>
        <div class="data-row"><span class="field">xeroContactId</span><span class="note">Read-only. "Sync to Xero" button if null. Shows Xero contact name if linked.</span></div>
        <div class="data-row" style="border-bottom:none;"><span class="field">stripeAccountId</span><span class="note">Read-only. Shows "V2 — not configured" in beta.</span></div>
      </div>
      <div class="data-section-header">Actions</div>
      <div style="padding:12px 16px;display:flex;flex-direction:column;gap:8px;font-size:11px;color:var(--text-2);line-height:1.65;">
        <div><strong style="color:var(--blue-lt);">Toggle Portal Access</strong> — enables/disables Talent Portal. Sends invite email on first enable. Sets user.active on subsequent toggles.</div>
        <div><strong style="color:var(--purple);">Preview Portal</strong> — opens /talent/preview/:talentId in new tab. Available to AGENCY_ADMIN and AGENT roles.</div>
        <div><strong style="color:var(--teal);">Sync to Xero</strong> — creates or matches Xero contact for this talent. Stores xeroContactId.</div>
      </div>
    </div>
  </div>

</div></div>


<div class="sec-head"><div class="wrap"><div class="sec-head-inner">
  <span class="sec-num">09</span>
  <div><div class="sec-title">Finance Portal</div><div class="sec-sub">All screens · invoice approval · chase notes · credit notes · expense approvals</div></div>
  <span class="sec-badge" style="background:var(--teal-dim);color:#5EEAD4;border:1px solid rgba(20,184,166,0.3);">Finance Portal</span>
</div></div></div>

<div class="sec-body"><div class="wrap">

  <div class="mono-label">Sidebar Navigation (Persistent)</div>
  <div style="margin-bottom:14px;font-size:11px;color:var(--text-2);line-height:1.7;">These are persistent sidebar navigation items across the session.</div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:28px;">
    <div style="background:var(--surface);border:1px solid rgba(20,184,166,0.3);border-radius:6px;padding:12px 14px;">
      <div style="font-family:var(--mono);font-size:9px;color:var(--teal);font-weight:700;margin-bottom:8px;">INVOICE QUEUE</div>
      <div style="font-size:10px;color:var(--text-2);line-height:1.7;">/finance/invoices<br>Default landing screen<br>Milestones awaiting approval<br>Deliverables inline · date edit</div>
    </div>
    <div style="background:var(--surface);border:1px solid rgba(20,184,166,0.3);border-radius:6px;padding:12px 14px;">
      <div style="font-family:var(--mono);font-size:9px;color:var(--teal);font-weight:700;margin-bottom:8px;">OVERDUE INVOICES</div>
      <div style="font-size:10px;color:var(--text-2);line-height:1.7;">/finance/overdue<br>All outstanding INVs<br>Age analysis · chase thread<br>Log new chase note</div>
    </div>
    <div style="background:var(--surface);border:1px solid rgba(20,184,166,0.3);border-radius:6px;padding:12px 14px;">
      <div style="font-family:var(--mono);font-size:9px;color:var(--teal);font-weight:700;margin-bottom:8px;">PAYOUT CENTRE</div>
      <div style="font-size:10px;color:var(--text-2);line-height:1.7;">/finance/payouts<br>Eligible milestones queue<br>Run batch · export PDF + CSV<br>Payout run history</div>
    </div>
    <div style="background:var(--surface);border:1px solid rgba(20,184,166,0.3);border-radius:6px;padding:12px 14px;">
      <div style="font-family:var(--mono);font-size:9px;color:var(--teal);font-weight:700;margin-bottom:8px;">CREDIT NOTES</div>
      <div style="font-size:10px;color:var(--text-2);line-height:1.7;">/finance/credit-notes<br>All MCNs · raise new MCN<br>Full / partial · replacement flag<br>Xero push status</div>
    </div>
    <div style="background:var(--surface);border:1px solid rgba(245,158,11,0.3);border-radius:6px;padding:12px 14px;">
      <div style="font-family:var(--mono);font-size:9px;color:var(--amber);font-weight:700;margin-bottom:8px;">EXPENSE APPROVALS</div>
      <div style="font-size:10px;color:var(--text-2);line-height:1.7;">/finance/expenses<br>Pending expense queue<br>contractSignOff warnings<br>Approve or reject</div>
    </div>
    <div style="background:var(--surface);border:1px solid rgba(20,184,166,0.3);border-radius:6px;padding:12px 14px;">
      <div style="font-family:var(--mono);font-size:9px;color:var(--teal);font-weight:700;margin-bottom:8px;">VAT COMPLIANCE</div>
      <div style="font-size:10px;color:var(--text-2);line-height:1.7;">/finance/vat<br>All talent VAT positions<br>Approaching · Imminent · Breached<br>Projected breach dates</div>
    </div>
    <div style="background:var(--surface);border:1px solid rgba(20,184,166,0.3);border-radius:6px;padding:12px 14px;">
      <div style="font-family:var(--mono);font-size:9px;color:var(--teal);font-weight:700;margin-bottom:8px;">XERO STATUS</div>
      <div style="font-size:10px;color:var(--text-2);line-height:1.7;">/finance/xero<br>Connection health<br>Last sync · failed pushes<br>Re-trigger sync</div>
    </div>
    <div style="background:var(--surface);border:1px solid rgba(30,85,204,0.2);border-radius:6px;padding:12px 14px;">
      <div style="font-family:var(--mono);font-size:9px;color:var(--blue-lt);font-weight:700;margin-bottom:8px;">DEALS (READ ONLY)</div>
      <div style="font-size:10px;color:var(--text-2);line-height:1.7;">/finance/deals<br>Read-only view of all deals<br>Milestone + invoice status<br>No editing permitted</div>
    </div>
  </div>

  <div class="mono-label">Invoice Approval Queue — /finance/invoices</div>
  <div class="card" style="margin-bottom:24px;">
    <div class="card-head"><div class="card-head-title">Queue Row — Fields & Approval Flow</div></div>
    <div class="card-body" style="padding:0;">
      <div class="data-section-header">Each queue row shows</div>
      <div style="display:grid;grid-template-columns:200px 1fr;gap:0;">
        <div class="data-row"><span class="field">Deal title</span><span class="note">Links to read-only deal view</span></div>
        <div class="data-row"><span class="field">Talent · Client</span><span class="note">Names from deal record</span></div>
        <div class="data-row"><span class="field">Milestone description</span><span class="note">Which milestone is being invoiced</span></div>
        <div class="data-row"><span class="field">Amount</span><span class="note">Gross milestone amount. Shows SBI, COM, and INV breakdown on expand.</span></div>
        <div class="data-row"><span class="field">Invoice date</span><span class="note">Editable field — defaults to milestone.invoiceDate. FD can amend before approving. Locked once pushed.</span></div>
        <div class="data-row"><span class="field">Deliverables status</span><span class="note">Inline panel: list of deliverables for this milestone with status badges. If any are not APPROVED, approve button is disabled with "X deliverables pending" message.</span></div>
        <div class="data-row" style="border-bottom:none;"><span class="field">Reconciliation check</span><span class="note">Warning shown if sum of all milestone amounts ≠ deal.totalValue. Approval blocked until resolved.</span></div>
      </div>
      <div class="data-section-header">Approval action</div>
      <div style="padding:12px 16px;font-size:11px;color:var(--text-2);line-height:1.8;">
        <div style="margin-bottom:6px;">"Approve & Push to Xero" button. On click: validate all checks pass → create InvoiceTriplet → push INV + SBI + COM to Xero in one batch → set milestone.status = INVOICED → deal stage auto-sets to IN BILLING if first invoice on this deal.</div>
        <div style="padding:8px 12px;background:var(--teal-dim);border:1px solid rgba(20,184,166,0.3);border-radius:4px;font-family:var(--mono);font-size:10px;color:var(--teal);">On success: show toast "INV-XXXX, SBI-XXXX, COM-XXXX pushed to Xero" · row disappears from queue · deal card moves to IN BILLING column.</div>
      </div>
    </div>
  </div>

  <div class="mono-label">Overdue Invoices & Chase Notes — /finance/overdue</div>
  <div class="card" style="margin-bottom:24px;">
    <div class="card-head"><div class="card-head-title">Overdue Invoice Row & Chase Thread</div></div>
    <div class="card-body" style="padding:0;">
      <div class="data-section-header">Row shows</div>
      <div style="display:grid;grid-template-columns:200px 1fr;gap:0;">
        <div class="data-row"><span class="field">INV reference</span><span class="note">INV-XXXX. Links to Xero invoice.</span></div>
        <div class="data-row"><span class="field">Client · Deal</span><span class="note">Client name and deal title</span></div>
        <div class="data-row"><span class="field">Amount · Due date</span><span class="note">Original invoice amount and due date</span></div>
        <div class="data-row"><span class="field">Days overdue</span><span class="note">Calculated from invoice due date. Colour: amber &lt;14d · red 14d+</span></div>
        <div class="data-row" style="border-bottom:none;"><span class="field">Next chase date</span><span class="note">From most recent ChaseNote.nextChaseDate. Shows "Follow up due" badge if date is today or past.</span></div>
      </div>
      <div class="data-section-header">Chase thread (expanded per invoice)</div>
      <div style="padding:12px 16px;font-size:11px;color:var(--text-2);line-height:1.8;">
        <div style="margin-bottom:8px;">Thread shows all ChaseNotes for this invoice, newest first. Each note: date · contactedName · method badge · note text · nextChaseDate.</div>
        <div style="margin-bottom:8px;"><strong style="color:var(--text);">Log Chase Note form:</strong> contactedName (pre-filled from client FINANCE contact, editable) · contactedEmail · method dropdown (EMAIL / PHONE / IN_PERSON / OTHER) · note text (required) · nextChaseDate (optional). Submit appends to thread. Cannot edit or delete existing notes.</div>
        <div style="padding:8px 12px;background:var(--amber-dim);border:1px solid rgba(245,158,11,0.3);border-radius:4px;font-family:var(--mono);font-size:10px;color:var(--amber);">Chase notes are append-only. Once logged they cannot be edited or deleted — this is an audit trail.</div>
      </div>
    </div>
  </div>

  <div class="mono-label">Credit Notes — /finance/credit-notes</div>
  <div class="card" style="margin-bottom:24px;">
    <div class="card-head"><div class="card-head-title">Raise Manual Credit Note</div></div>
    <div class="card-body">
      <div style="font-size:11px;color:var(--text-2);line-height:1.8;margin-bottom:14px;">Credit notes can only be raised against an invoice that has already been pushed to Xero (status = PUSHED or beyond). FD selects the invoice from a searchable list of pushed invoices.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div>
          <div style="font-size:11px;font-weight:600;color:var(--text);margin-bottom:8px;">Form fields</div>
          <div style="display:flex;flex-direction:column;gap:5px;font-size:11px;color:var(--text-2);line-height:1.6;">
            <div><span style="font-family:var(--mono);font-size:10px;color:var(--blue-lt);">tripletId</span> — select invoice to credit (searchable dropdown)</div>
            <div><span style="font-family:var(--mono);font-size:10px;color:var(--blue-lt);">cnDate</span> — defaults to today, editable</div>
            <div><span style="font-family:var(--mono);font-size:10px;color:var(--blue-lt);">amount</span> — full or partial. Shows original invoice amount for reference.</div>
            <div><span style="font-family:var(--mono);font-size:10px;color:var(--blue-lt);">reason</span> — required free-text. Logged to audit trail.</div>
            <div><span style="font-family:var(--mono);font-size:10px;color:var(--green);">requiresReplacement</span> — Boolean toggle. If ON: agent will be notified to create a replacement milestone.</div>
          </div>
        </div>
        <div>
          <div style="font-size:11px;font-weight:600;color:var(--text);margin-bottom:8px;">On confirm</div>
          <div style="display:flex;flex-direction:column;gap:6px;font-size:11px;color:var(--text-2);line-height:1.6;">
            <div>MCN record created with MCN-XXXX reference</div>
            <div>Pushed to Xero as credit note against original INV</div>
            <div>If full CN + requiresReplacement=true: milestone.status → CANCELLED · amber badge appears on deal card in Agency Portal · agent receives in-app notification</div>
            <div>If full CN + requiresReplacement=false: deal moves toward COMPLETE (if all other milestones done)</div>
            <div>Partial CN: original milestone stays ACTIVE, reduced balance in Xero</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="mono-label">Expense Approvals — /finance/expenses</div>
  <div class="card" style="margin-bottom:0;">
    <div class="card-head"><div class="card-head-title">Pending Expense Queue</div></div>
    <div class="card-body">
      <div style="font-size:11px;color:var(--text-2);line-height:1.8;margin-bottom:12px;">Lists all DealExpenses with status=PENDING. Finance user reviews and approves or rejects with a note.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div style="font-size:11px;color:var(--text-2);line-height:1.8;">
          <strong style="color:var(--text);">Each row shows:</strong> deal title · expense description · category · amount · incurredBy · rechargeable badge · contractSignOff badge (amber warning if false) · receipt link if uploaded.
        </div>
        <div>
          <div style="padding:8px 12px;background:var(--amber-dim);border:1px solid rgba(245,158,11,0.3);border-radius:4px;font-size:11px;color:var(--amber);margin-bottom:8px;line-height:1.6;"><strong>If contractSignOff=false:</strong> amber banner on row — "This expense was not pre-approved in the contract. Confirm to proceed." FD must tick a checkbox before approve button is enabled.</div>
          <div style="font-size:11px;color:var(--text-2);line-height:1.65;"><strong style="color:var(--text);">Self-approval guard:</strong> The user who created the expense cannot approve it. Approve button disabled with tooltip "Cannot approve your own expense."</div>
        </div>
      </div>
    </div>
  </div>

</div></div>


<div class="sec-head"><div class="wrap"><div class="sec-head-inner">
  <span class="sec-num">10</span>
  <div><div class="sec-title">Talent Portal</div><div class="sec-sub">All screens · data scoping rules · what talent can and cannot see</div></div>
  <span class="sec-badge" style="background:var(--purple-dim);color:#C4B5FD;border:1px solid rgba(139,92,246,0.3);">Talent Portal</span>
</div></div></div>

<div class="sec-body"><div class="wrap">

  <div class="callout callout-blue" style="margin-bottom:28px;">
    <strong>Strict data scope.</strong> Every query in the Talent Portal must be filtered by the authenticated user's talentId. A talent must never see another talent's data. Enforce this at the API layer — never trust client-side filtering. Any route returning talent data must include a talentId ownership check.
  </div>

  <div class="mono-label">Screen Map</div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:28px;">
    <div style="background:var(--surface);border:1px solid rgba(139,92,246,0.3);border-radius:6px;padding:12px 14px;">
      <div style="font-family:var(--mono);font-size:9px;color:#C4B5FD;font-weight:700;margin-bottom:8px;">MY DEALS</div>
      <div style="font-size:10px;color:var(--text-2);line-height:1.7;">/talent/deals<br>Default landing screen<br>Active deals only<br>Milestone chips · status</div>
    </div>
    <div style="background:var(--surface);border:1px solid rgba(139,92,246,0.3);border-radius:6px;padding:12px 14px;">
      <div style="font-family:var(--mono);font-size:9px;color:#C4B5FD;font-weight:700;margin-bottom:8px;">PAYOUT SCHEDULE</div>
      <div style="font-size:10px;color:var(--text-2);line-height:1.7;">/talent/payouts<br>Upcoming net payouts<br>Per milestone · amounts<br>Status: waiting / eligible</div>
    </div>
    <div style="background:var(--surface);border:1px solid rgba(139,92,246,0.3);border-radius:6px;padding:12px 14px;">
      <div style="font-family:var(--mono);font-size:9px;color:#C4B5FD;font-weight:700;margin-bottom:8px;">REMITTANCES</div>
      <div style="font-size:10px;color:var(--text-2);line-height:1.7;">/talent/remittances<br>All payout run PDFs<br>Download per run<br>PR reference · date · amount</div>
    </div>
    <div style="background:var(--surface);border:1px solid rgba(139,92,246,0.3);border-radius:6px;padding:12px 14px;">
      <div style="font-family:var(--mono);font-size:9px;color:#C4B5FD;font-weight:700;margin-bottom:8px;">EARNINGS</div>
      <div style="font-size:10px;color:var(--text-2);line-height:1.7;">/talent/earnings<br>All-time earnings history<br>Gross · commission · net<br>Filterable by period</div>
    </div>
  </div>

  <div class="g2" style="margin-bottom:24px;">

    <div class="card">
      <div class="card-head" style="background:var(--purple-dim);border-color:rgba(139,92,246,0.2);">
        <div class="card-head-title" style="color:#C4B5FD;">My Deals — /talent/deals</div>
      </div>
      <div class="card-body" style="padding:0 16px;">
        <div class="step-list">
          <div class="step"><div class="step-num" style="background:var(--purple-dim);color:#C4B5FD;">1</div><div class="step-content"><div class="step-title">Deal list</div><div class="step-desc">All deals where deal.talentId = auth.talentId AND stage ≠ COMPLETE. Shows: deal title · client name · total value · commission rate · stage badge.</div></div></div>
          <div class="step"><div class="step-num" style="background:var(--purple-dim);color:#C4B5FD;">2</div><div class="step-content"><div class="step-title">Milestone chips</div><div class="step-desc">Per deal: colour-coded milestone progress chips. Same chip colours as agent board. Hovering a chip shows milestone name and amount.</div></div></div>
          <div class="step"><div class="step-num" style="background:var(--purple-dim);color:#C4B5FD;">3</div><div class="step-content"><div class="step-title">Deal detail (expanded)</div><div class="step-desc">Clicking a deal shows: milestone list with status, deliverable descriptions (read-only), expected payout per milestone (net). Does NOT show: notes, expenses, invoice numbers, Xero refs.</div></div></div>
          <div class="step" style="border:none;"><div class="step-num" style="background:var(--purple-dim);color:#C4B5FD;">4</div><div class="step-content"><div class="step-title">ON_BEHALF invoices tab</div><div class="step-desc">If agency.invoicingModel = ON_BEHALF: show "Invoices" tab on deal detail with list of OBI invoices. If SELF_BILLING: tab is hidden. CN documents are never shown to talent in either model.</div></div></div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head" style="background:var(--purple-dim);border-color:rgba(139,92,246,0.2);">
        <div class="card-head-title" style="color:#C4B5FD;">Payout Schedule — /talent/payouts</div>
      </div>
      <div class="card-body" style="padding:0 16px;">
        <div class="step-list">
          <div class="step"><div class="step-num" style="background:var(--purple-dim);color:#C4B5FD;">1</div><div class="step-content"><div class="step-title">Upcoming payouts</div><div class="step-desc">All milestones where deal.talentId = auth.talentId AND milestone.status IN (ACTIVE, INVOICED, PAID). Shows: deal title · milestone description · gross amount · commission deduction · net payout amount.</div></div></div>
          <div class="step"><div class="step-num" style="background:var(--purple-dim);color:#C4B5FD;">2</div><div class="step-content"><div class="step-title">Status labels</div><div class="step-desc">ACTIVE/INVOICED: "Awaiting client payment" · PAID: "Payout ready — processing" · PAYOUT_COMPLETE: moves to earnings history.</div></div></div>
          <div class="step" style="border:none;"><div class="step-num" style="background:var(--purple-dim);color:#C4B5FD;">3</div><div class="step-content"><div class="step-title">What to hide</div><div class="step-desc">Do not show: INV reference numbers, Xero IDs, internal invoice dates, agency bank details, payout run references. Talent sees outcome (net amount, status) not financial plumbing.</div></div></div>
        </div>
      </div>
    </div>

  </div>

  <div class="g2">

    <div class="card">
      <div class="card-head" style="background:var(--purple-dim);border-color:rgba(139,92,246,0.2);">
        <div class="card-head-title" style="color:#C4B5FD;">Remittances — /talent/remittances</div>
      </div>
      <div class="card-body">
        <div style="font-size:11px;color:var(--text-2);line-height:1.8;">
          <div style="margin-bottom:8px;">Table of all completed payout runs for this talent. Columns: date · PR reference · number of milestones · net amount paid · Download PDF button.</div>
          <div style="margin-bottom:8px;">Download triggers a pre-signed URL for the remittance PDF stored in cloud storage. PDF is identical to the one Finance downloaded — gross, commission, net, itemised per milestone.</div>
          <div style="padding:8px 10px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:4px;font-family:var(--mono);font-size:10px;color:var(--text-3);">Only shows payout runs where PayoutRun.status = PAID — i.e. Finance has confirmed the manual transfer was made.</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head" style="background:var(--purple-dim);border-color:rgba(139,92,246,0.2);">
        <div class="card-head-title" style="color:#C4B5FD;">Earnings History — /talent/earnings</div>
      </div>
      <div class="card-body">
        <div style="font-size:11px;color:var(--text-2);line-height:1.8;">
          <div style="margin-bottom:8px;">All completed milestones for this talent. For each: deal title · brand/client name · gross amount · commission deducted · net received · date paid out.</div>
          <div style="margin-bottom:8px;">Summary totals at top: all-time gross earnings · total commission paid · all-time net earnings.</div>
          <div>Filter by: date range (month / quarter / tax year / custom). Useful for self-assessment — talent can see all income in a tax year at a glance.</div>
        </div>
      </div>
    </div>

  </div>

</div></div>


<div class="sec-head"><div class="wrap"><div class="sec-head-inner">
  <span class="sec-num">11</span>
  <div><div class="sec-title">End-to-End Deal Flow</div><div class="sec-sub">Full sequence from deal creation to talent paid out · who acts at each step · what changes in the database</div></div>
  <span class="sec-badge" style="background:var(--green-dim);color:var(--green);border:1px solid rgba(16,185,129,0.3);">Master Flow</span>
</div></div></div>

<div class="sec-body"><div class="wrap">

  <div style="border-radius:8px;overflow:hidden;border:1px solid var(--border);">
    <div style="display:grid;grid-template-columns:36px 160px 1fr 140px 160px;gap:0;padding:8px 16px 6px;font-family:var(--mono);font-size:9px;color:var(--text-3);letter-spacing:1px;text-transform:uppercase;border-bottom:1px solid var(--border);background:rgba(255,255,255,0.02);">
      <div>#</div><div>Actor</div><div>Action</div><div>Portal</div><div>State change</div>
    </div>

    <div style="display:grid;grid-template-columns:36px 160px 1fr 140px 160px;gap:0;padding:9px 16px;border-bottom:1px solid var(--border);align-items:start;">
      <div style="font-family:var(--mono);font-size:10px;color:var(--text-3);">1</div>
      <div style="font-family:var(--mono);font-size:10px;color:var(--blue-lt);">Agent</div>
      <div style="font-size:11px;color:var(--text-2);">Creates deal — title, client, talent, total value, commission rate, stage = PROSPECT</div>
      <div style="font-family:var(--mono);font-size:9px;color:var(--blue-lt);padding-top:1px;">Agency</div>
      <div style="font-family:var(--mono);font-size:9px;color:var(--text-3);padding-top:1px;">deal.stage = PROSPECT</div>
    </div>
    <div style="display:grid;grid-template-columns:36px 160px 1fr 140px 160px;gap:0;padding:9px 16px;border-bottom:1px solid var(--border);align-items:start;background:rgba(255,255,255,0.02);">
      <div style="font-family:var(--mono);font-size:10px;color:var(--text-3);">2</div>
      <div style="font-family:var(--mono);font-size:10px;color:var(--blue-lt);">Agent</div>
      <div style="font-size:11px;color:var(--text-2);">Advances stage through NEGOTIATING → CONTRACTING as discussions progress. Probability editable at each step.</div>
      <div style="font-family:var(--mono);font-size:9px;color:var(--blue-lt);padding-top:1px;">Agency</div>
      <div style="font-family:var(--mono);font-size:9px;color:var(--amber);padding-top:1px;">deal.stage = CONTRACTING</div>
    </div>
    <div style="display:grid;grid-template-columns:36px 160px 1fr 140px 160px;gap:0;padding:9px 16px;border-bottom:1px solid var(--border);align-items:start;">
      <div style="font-family:var(--mono);font-size:10px;color:var(--text-3);">3</div>
      <div style="font-family:var(--mono);font-size:10px;color:var(--blue-lt);">Agent</div>
      <div style="font-size:11px;color:var(--text-2);">Creates milestones (amounts must sum to totalValue). Adds deliverables to each milestone. Sets invoice dates. Uploads contract PDF.</div>
      <div style="font-family:var(--mono);font-size:9px;color:var(--blue-lt);padding-top:1px;">Agency</div>
      <div style="font-family:var(--mono);font-size:9px;color:var(--text-3);padding-top:1px;">Milestone records created<br>status = PENDING</div>
    </div>
    <div style="display:grid;grid-template-columns:36px 160px 1fr 140px 160px;gap:0;padding:9px 16px;border-bottom:1px solid var(--border);align-items:start;background:rgba(255,255,255,0.02);">
      <div style="font-family:var(--mono);font-size:10px;color:var(--text-3);">4</div>
      <div style="font-family:var(--mono);font-size:10px;color:var(--blue-lt);">Agent</div>
      <div style="font-size:11px;color:var(--text-2);">Clicks "Move to Active". Readiness gate runs. Resolves any hard blocks, acknowledges warnings. Confirms invoicing model modal.</div>
      <div style="font-family:var(--mono);font-size:9px;color:var(--blue-lt);padding-top:1px;">Agency</div>
      <div style="font-family:var(--mono);font-size:9px;color:var(--blue-lt);padding-top:1px;">deal.stage = ACTIVE<br>deal fields locked</div>
    </div>
    <div style="display:grid;grid-template-columns:36px 160px 1fr 140px 160px;gap:0;padding:9px 16px;border-bottom:1px solid var(--border);align-items:start;">
      <div style="font-family:var(--mono);font-size:10px;color:var(--text-3);">5</div>
      <div style="font-family:var(--mono);font-size:10px;color:var(--blue-lt);">Agent</div>
      <div style="font-size:11px;color:var(--text-2);">As deliverables are completed, marks each deliverable SUBMITTED → APPROVED. All deliverables on a milestone approved → milestone becomes READY_TO_INVOICE.</div>
      <div style="font-family:var(--mono);font-size:9px;color:var(--blue-lt);padding-top:1px;">Agency</div>
      <div style="font-family:var(--mono);font-size:9px;color:var(--teal);padding-top:1px;">milestone.status =<br>READY_TO_INVOICE</div>
    </div>
    <div style="display:grid;grid-template-columns:36px 160px 1fr 140px 160px;gap:0;padding:9px 16px;border-bottom:1px solid var(--border);align-items:start;background:rgba(255,255,255,0.02);">
      <div style="font-family:var(--mono);font-size:10px;color:var(--text-3);">6</div>
      <div style="font-family:var(--mono);font-size:10px;color:var(--teal);">Finance</div>
      <div style="font-size:11px;color:var(--text-2);">Sees milestone in Invoice Queue. Reviews deliverables inline. Confirms or amends invoice date. Clicks "Approve & Push to Xero".</div>
      <div style="font-family:var(--mono);font-size:9px;color:var(--teal);padding-top:1px;">Finance</div>
      <div style="font-family:var(--mono);font-size:9px;color:var(--teal);padding-top:1px;">InvoiceTriplet created<br>milestone.status = INVOICED<br>deal.stage = IN_BILLING</div>
    </div>
    <div style="display:grid;grid-template-columns:36px 160px 1fr 140px 160px;gap:0;padding:9px 16px;border-bottom:1px solid var(--border);align-items:start;">
      <div style="font-family:var(--mono);font-size:10px;color:var(--text-3);">7</div>
      <div style="font-family:var(--mono);font-size:10px;color:var(--teal);">Xero / System</div>
      <div style="font-size:11px;color:var(--text-2);">Client pays INV in Xero. Xero fires webhook to Therum. Therum verifies HMAC, reads updated invoice status, updates milestone.</div>
      <div style="font-family:var(--mono);font-size:9px;color:var(--green);padding-top:1px;">System</div>
      <div style="font-family:var(--mono);font-size:9px;color:var(--green);padding-top:1px;">milestone.status = PAID<br>payoutEligible = true</div>
    </div>
    <div style="display:grid;grid-template-columns:36px 160px 1fr 140px 160px;gap:0;padding:9px 16px;border-bottom:1px solid var(--border);align-items:start;background:rgba(255,255,255,0.02);">
      <div style="font-family:var(--mono);font-size:10px;color:var(--text-3);">8</div>
      <div style="font-family:var(--mono);font-size:10px;color:var(--teal);">Finance</div>
      <div style="font-size:11px;color:var(--text-2);">Opens Payout Centre. Reviews eligible milestone(s). Confirms payout batch. Downloads remittance PDFs and bank transfer CSV.</div>
      <div style="font-family:var(--mono);font-size:9px;color:var(--teal);padding-top:1px;">Finance</div>
      <div style="font-family:var(--mono);font-size:9px;color:var(--teal);padding-top:1px;">PayoutRun created<br>status = CONFIRMED<br>Exports generated</div>
    </div>
    <div style="display:grid;grid-template-columns:36px 160px 1fr 140px 160px;gap:0;padding:9px 16px;border-bottom:1px solid var(--border);align-items:start;">
      <div style="font-family:var(--mono);font-size:10px;color:var(--text-3);">9</div>
      <div style="font-family:var(--mono);font-size:10px;color:var(--teal);">Finance</div>
      <div style="font-size:11px;color:var(--text-2);">Transfers net amounts to talent via bank (using CSV as reference). Returns to Therum and marks the payout run as PAID.</div>
      <div style="font-family:var(--mono);font-size:9px;color:var(--teal);padding-top:1px;">Finance</div>
      <div style="font-family:var(--mono);font-size:9px;color:var(--purple);padding-top:1px;">milestone.status =<br>PAYOUT_COMPLETE<br>PayoutRun.status = PAID</div>
    </div>
    <div style="display:grid;grid-template-columns:36px 160px 1fr 140px 160px;gap:0;padding:9px 16px;align-items:start;background:rgba(255,255,255,0.02);">
      <div style="font-family:var(--mono);font-size:10px;color:var(--text-3);">10</div>
      <div style="font-family:var(--mono);font-size:10px;color:var(--green);">System</div>
      <div style="font-size:11px;color:var(--text-2);">If all milestones on the deal are now PAYOUT_COMPLETE: deal.stage auto-sets to COMPLETE. Deal card moves to COMPLETE column, then archives.</div>
      <div style="font-family:var(--mono);font-size:9px;color:var(--green);padding-top:1px;">System</div>
      <div style="font-family:var(--mono);font-size:9px;color:var(--green);padding-top:1px;">deal.stage = COMPLETE<br>→ archive view</div>
    </div>
  </div>

  <div style="margin-top:14px;padding:12px 16px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:6px;font-size:11px;color:var(--text-2);line-height:1.75;">
    <strong style="color:var(--text);">Multi-milestone deals:</strong> Steps 5–9 repeat independently per milestone. A deal with three milestones cycles through steps 5–9 three times before step 10 triggers. The deal remains in IN BILLING throughout until every milestone reaches PAYOUT_COMPLETE.
  </div>

</div></div>

<footer class="doc-footer">
  <span>THERUM-BETA-001 · v1.0 · April 2026 · Confidential</span>
  <span>Therum Technologies Ltd · therum.io</span>
</footer>

</body>
</html>
