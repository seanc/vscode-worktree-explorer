// #25: the Tickets sidebar (design A). Renders the SidebarModel posted by the extension with
// textContent only, and posts back { action, id } messages the extension re-validates.
/* global window, document, acquireVsCodeApi */
(function () {
  'use strict';

  const vscode = acquireVsCodeApi();
  const { el, icon, button } = window.ticketDom;
  const root = document.getElementById('root');
  const saved = vscode.getState() || {};
  let selectedId = typeof saved.selectedId === 'string' ? saved.selectedId : undefined;
  let model;

  function post(action, id) {
    vscode.postMessage({ action, id });
  }

  function select(id) {
    selectedId = selectedId === id ? undefined : id;
    vscode.setState({ selectedId });
    render();
    const card = root.querySelector(`[data-index="${cardIndex(id)}"]`);
    if (card) {
      card.focus();
    }
  }

  function cardIndex(id) {
    return model ? model.active.findIndex((c) => c.id === id) : -1;
  }

  function sectionTitle(text, count) {
    return el('h2', 'section-title', `${text} · ${count}`);
  }

  function cardHead(card) {
    const head = el('div', 'card-head');
    if (card.key) {
      head.appendChild(el('span', 'key mono', card.key));
    }
    const title = el('span', 'title', card.title);
    title.title = card.title;
    head.appendChild(title);
    return head;
  }

  function branchLine(card) {
    const line = el('div', 'branch mono');
    line.appendChild(icon('branch'));
    const text = el('span', '', card.branch);
    text.title = card.branch;
    line.appendChild(text);
    return line;
  }

  function badges(card) {
    const row = el('div', 'badges');
    for (const badge of card.badges) {
      row.appendChild(el('span', `badge ${badge.tone}`, badge.text));
    }
    return row;
  }

  function activeCard(card, index) {
    const item = el('li', 'card');
    const expanded = card.id === selectedId;
    item.tabIndex = 0;
    item.dataset.index = String(index);
    item.setAttribute('aria-expanded', String(expanded));
    item.setAttribute('aria-label', `${card.key ? card.key + ', ' : ''}${card.title}${card.isActive ? ', shown in Worktree Explorer' : ''}`);
    if (card.isActive) {
      item.setAttribute('aria-current', 'true');
    }
    item.appendChild(cardHead(card));
    item.appendChild(branchLine(card));
    item.appendChild(badges(card));
    if (card.isActive) {
      const note = el('div', 'active-note');
      note.appendChild(icon('eye'));
      note.appendChild(el('span', '', 'Shown in Worktree Explorer'));
      item.appendChild(note);
    }
    if (expanded) {
      const details = databaseDetails(card);
      if (details) {
        item.appendChild(details);
      }
      const actions = el('div', 'actions');
      actions.appendChild(button('Open window', () => post('openWindow', card.id), 'primary'));
      if (!card.isActive) {
        actions.appendChild(button('Show in explorer', () => post('showInExplorer', card.id)));
      }
      actions.appendChild(button('Overview', () => post('openOverview', card.id)));
      if (card.hasUrl) {
        actions.appendChild(button('Jira', () => post('openLink', card.id)));
      }
      if (card.canServe) {
        actions.appendChild(button('Serve via tunnel', () => post('serve', card.id)));
      }
      if (card.hasTest) {
        actions.appendChild(button('Copy test command', () => post('copyTest', card.id)));
      }
      if (card.hasNotes) {
        actions.appendChild(button('Notes', () => post('openNotes', card.id)));
      }
      item.appendChild(actions);
    }
    item.addEventListener('click', () => select(card.id));
    item.addEventListener('keydown', (event) => onCardKey(event, card, index));
    return item;
  }

  function databaseDetails(card) {
    if (card.devDatabases.length === 0 && card.testDatabases.length === 0) {
      return undefined;
    }
    const list = el('dl', 'details');
    if (card.devDatabases.length > 0) {
      list.appendChild(el('dt', '', card.devDatabases.length === 1 ? 'Dev DB' : 'Dev DBs'));
      list.appendChild(el('dd', '', card.devDatabases.join(', ')));
    }
    if (card.testDatabases.length > 0) {
      list.appendChild(el('dt', '', card.testDatabases.length === 1 ? 'Test DB' : 'Test DBs'));
      list.appendChild(el('dd', '', card.testDatabases.join(', ')));
    }
    return list;
  }

  function onCardKey(event, card, index) {
    if (event.target !== event.currentTarget) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      select(card.id);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = root.querySelector(`[data-index="${index + (event.key === 'ArrowDown' ? 1 : -1)}"]`);
      if (next) {
        next.focus();
      }
    }
  }

  function cleanupCard(card) {
    const item = el('li', 'card cleanup');
    item.appendChild(cardHead(card));
    const line = el('div', 'warning-line');
    line.appendChild(icon('warning'));
    line.appendChild(el('span', '', `Looks merged: ${card.cleanup.evidence}`));
    item.appendChild(line);
    if (card.cleanup.uncommitted > 0) {
      item.appendChild(el('div', 'hint', `${card.cleanup.uncommitted} uncommitted change${card.cleanup.uncommitted === 1 ? '' : 's'} — commit or stash before removing.`));
    }
    item.appendChild(el('div', 'hint', 'Based on your local copy of the base branch. Pull it to update.'));
    const actions = el('div', 'actions');
    if (model.cleanupCommandConfigured && card.key) {
      actions.appendChild(button('Copy cleanup command', () => post('copyCleanup', card.id), 'primary'));
    }
    actions.appendChild(button('Remove worktree…', () => post('removeWorktree', card.id), 'danger'));
    actions.appendChild(button('Overview', () => post('openOverview', card.id)));
    item.appendChild(actions);
    return item;
  }

  function render() {
    root.replaceChildren();
    if (!model) {
      root.appendChild(el('p', 'empty', 'Loading tickets…'));
      return;
    }
    if (model.main.length > 0) {
      root.appendChild(el('h2', 'section-title', 'Main checkout'));
      for (const main of model.main) {
        const row = el('div', 'main-row');
        row.appendChild(icon('home'));
        const branch = el('span', 'mono', main.branch);
        branch.title = main.branch;
        row.appendChild(branch);
        if (main.served) {
          row.appendChild(el('span', 'badge success', '● Tunnel'));
        } else if (main.canServe) {
          const serve = button('Serve', () => post('serve', main.id));
          serve.setAttribute('aria-label', 'Serve the main checkout through the tunnel');
          row.appendChild(serve);
        }
        root.appendChild(row);
      }
    }
    if (model.active.length === 0 && model.cleanup.length === 0) {
      root.appendChild(el('p', 'empty', 'No linked Git worktrees were found. Each linked worktree shows here as a ticket.'));
    }
    if (model.active.length > 0) {
      root.appendChild(sectionTitle('Active', model.active.length));
      const list = el('ul', 'cards');
      list.setAttribute('aria-label', 'Active tickets');
      model.active.forEach((card, index) => list.appendChild(activeCard(card, index)));
      root.appendChild(list);
    }
    if (model.cleanup.length > 0) {
      root.appendChild(sectionTitle('Ready to clean up', model.cleanup.length));
      const list = el('ul', 'cards');
      list.setAttribute('aria-label', 'Tickets ready to clean up');
      model.cleanup.forEach((card) => list.appendChild(cleanupCard(card)));
      root.appendChild(list);
    }
  }

  window.addEventListener('message', (event) => {
    const message = event.data;
    if (message && message.type === 'model' && message.model) {
      model = message.model;
      if (selectedId === undefined || cardIndex(selectedId) === -1) {
        const active = model.active.find((c) => c.isActive);
        selectedId = active ? active.id : undefined;
      }
      render();
    }
  });

  render();
  vscode.postMessage({ action: 'ready' });
})();
