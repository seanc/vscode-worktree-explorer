// #25: the ticket overview editor (design A's right-hand panel). Renders the OverviewModel posted
// by the extension with textContent only; file paths are sent back for the extension to validate.
/* global window, document, acquireVsCodeApi */
(function () {
  'use strict';

  const vscode = acquireVsCodeApi();
  const { el, icon, button } = window.ticketDom;
  const root = document.getElementById('root');

  function post(action, id, extra) {
    vscode.postMessage(Object.assign({ action, id }, extra || {}));
  }

  function panel(title, headExtra) {
    const section = el('section', 'panel');
    const head = el('div', 'panel-head');
    head.appendChild(el('h2', '', title));
    if (headExtra) {
      head.appendChild(headExtra);
    }
    section.appendChild(head);
    return section;
  }

  function header(model) {
    const node = el('header');
    const left = el('div');
    const eyebrow = [model.key, model.kind].filter(Boolean).join(' · ');
    if (eyebrow) {
      left.appendChild(el('div', 'eyebrow mono', eyebrow));
    }
    left.appendChild(el('h1', '', model.title));
    left.appendChild(el('div', 'mono muted', model.branch));
    if (model.aheadText) {
      left.appendChild(el('div', 'muted', model.aheadText));
    }
    left.appendChild(el('div', 'hint', model.baseText));
    node.appendChild(left);

    const actions = el('div', 'actions');
    if (model.hasUrl) {
      actions.appendChild(button('Open in Jira', () => post('openLink', model.id), 'primary'));
    }
    if (model.hasNotes) {
      actions.appendChild(button('Ticket notes', () => post('openNotes', model.id)));
    }
    if (model.isActive) {
      const note = el('span', 'active-note');
      note.appendChild(icon('eye'));
      note.appendChild(el('span', '', 'Shown in Worktree Explorer'));
      actions.appendChild(note);
    } else {
      actions.appendChild(button('Show in explorer', () => post('showInExplorer', model.id)));
    }
    if (model.served) {
      actions.appendChild(el('span', 'badge success', '● Served through the tunnel'));
    } else if (model.canServe) {
      actions.appendChild(button('Serve via tunnel', () => post('serve', model.id)));
    }
    actions.appendChild(button('Open window', () => post('openWindow', model.id)));
    node.appendChild(actions);
    return node;
  }

  function cleanupBanner(model) {
    const banner = el('section', 'banner');
    const line = el('div', 'warning-line');
    line.appendChild(icon('warning'));
    line.appendChild(el('span', '', `Looks merged: ${model.cleanup.evidence}`));
    banner.appendChild(line);
    if (model.cleanup.uncommitted > 0) {
      banner.appendChild(el('div', 'hint', `${model.cleanup.uncommitted} uncommitted change${model.cleanup.uncommitted === 1 ? '' : 's'} — commit or stash before removing.`));
    }
    banner.appendChild(el('div', 'hint', 'Based on your local copy of the base branch. Pull it to update.'));
    const actions = el('div', 'actions');
    if (model.cleanupCommandConfigured && model.key) {
      actions.appendChild(button('Copy cleanup command', () => post('copyCleanup', model.id), 'primary'));
    }
    actions.appendChild(button('Remove worktree…', () => post('removeWorktree', model.id), 'danger'));
    banner.appendChild(actions);
    return banner;
  }

  function environment(model) {
    const section = panel('Environment');
    const list = el('dl');
    for (const row of model.environment) {
      list.appendChild(el('dt', '', row.label));
      list.appendChild(el('dd', 'mono', row.value));
    }
    section.appendChild(list);
    return section;
  }

  function tests(model) {
    const section = panel('Run tests in this worktree', button('Copy', () => post('copyTest', model.id)));
    section.appendChild(el('div', 'code', model.testCommand));
    return section;
  }

  function changes(model) {
    const section = el('section', 'panel');
    section.appendChild(el('h2', '', `Changed vs base · ${model.changes.length}${model.changesTruncated ? '+' : ''}`));
    if (model.changes.length === 0) {
      section.appendChild(el('p', 'muted', 'No changes against the base branch yet.'));
      return section;
    }
    const list = el('ul', 'changes');
    for (const change of model.changes) {
      const item = el('li');
      const open = button('', () => post('compare', model.id, { path: change.path, deleted: change.deleted }), 'change');
      open.replaceChildren(el('span', `letter ${change.letter}`, change.letter), el('span', '', change.path));
      open.title = `${change.label}: compare with the base branch`;
      open.setAttribute('aria-label', `${change.label}: ${change.path}. Compare with the base branch.`);
      item.appendChild(open);
      list.appendChild(item);
    }
    section.appendChild(list);
    if (model.changesTruncated) {
      section.appendChild(el('p', 'hint', 'Showing the first 300 files.'));
    }
    return section;
  }

  function render(model) {
    root.replaceChildren();
    const page = el('div', 'overview');
    page.appendChild(header(model));
    if (model.cleanup) {
      page.appendChild(cleanupBanner(model));
    }
    const grid = el('div', 'grid');
    grid.appendChild(environment(model));
    if (model.testCommand) {
      grid.appendChild(tests(model));
    }
    page.appendChild(grid);
    page.appendChild(changes(model));
    root.appendChild(page);
  }

  window.addEventListener('message', (event) => {
    const message = event.data;
    if (message && message.type === 'model' && message.model) {
      render(message.model);
    } else if (message && message.type === 'gone') {
      root.replaceChildren(el('p', 'empty', 'This worktree no longer exists.'));
    }
  });

  root.replaceChildren(el('p', 'empty', 'Loading…'));
  vscode.postMessage({ action: 'ready' });
})();
