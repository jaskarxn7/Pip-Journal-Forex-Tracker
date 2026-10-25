'use strict';

    const STORAGE_KEY = 'pipJournalTrades';
    const $ = (id) => document.getElementById(id);
    let trades = loadTrades();
    let direction = 'Long';
    let drawMode = false;
    let activeFilter = 'all';
    let customStart = '';
    let customEnd = '';
    let pendingDeleteId = null;

    function loadTrades() {
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        if (!Array.isArray(saved)) return [];
        return saved.filter(t => t && typeof t === 'object' && t.id != null).map(t => ({
          ...t,
          pair: String(t.pair || 'EURUSD'),
          date: /^\d{4}-\d{2}-\d{2}$/.test(t.date) ? t.date : today(),
          actualPips: Number.isFinite(Number(t.actualPips)) ? Number(t.actualPips) : 0,
          isDraw: Boolean(t.isDraw),
          notes: String(t.notes || '')
        }));
      } catch (error) {
        console.warn('Could not read saved trades:', error);
        return [];
      }
    }

    function saveTrades() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
        return true;
      } catch (error) {
        alert('Your changes could not be saved. Browser storage may be full or disabled.');
        console.error('Could not save trades:', error);
        return false;
      }
    }

    function today() {
      const now = new Date();
      const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
      return local.toISOString().slice(0, 10);
    }

    function numberFrom(id) {
      const value = $(id).value.trim();
      if (value === '') return null;
      const number = Number(value);
      return Number.isFinite(number) ? number : null;
    }

    function setDirection(value) {
      direction = value;
      document.querySelectorAll('[data-direction]').forEach(button => {
        button.classList.toggle('active', button.dataset.direction === value);
        button.classList.toggle('long', button.dataset.direction === value && value === 'Long');
        button.classList.toggle('short', button.dataset.direction === value && value === 'Short');
      });
    }

    function showForm(isDraw = false, trade = null) {
      drawMode = isDraw;
      $('formPanel').classList.remove('hidden');
      $('formTitle').textContent = trade ? 'Edit trade' : isDraw ? 'Log a draw' : 'Add trade';
      $('saveBtn').textContent = trade ? 'Update trade' : isDraw ? 'Save draw' : 'Save trade';
      $('tradeId').value = trade ? String(trade.id) : '';
      $('date').value = trade?.date || today();
      $('pair').value = trade?.pair || '';
      $('entry').value = trade?.entry ?? '';
      $('sl').value = trade?.sl ?? '';
      $('tp1').value = trade?.tp1 ?? '';
      $('tp2').value = trade?.tp2 ?? '';
      $('tp3').value = trade?.tp3 ?? '';
      $('actual').value = trade && !trade.isDraw ? trade.actualPips : '';
      $('notes').value = trade?.notes || '';
      $('formError').classList.add('hidden');
      ['directionField','entryField','slField','tp1Field','tp2Field','tp3Field','actualField'].forEach(id => $(id).classList.toggle('hidden', isDraw));
      setDirection(trade?.direction || 'Long');
      $('formPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
      $('pair').focus({ preventScroll: true });
    }

    function closeForm() {
      $('formPanel').classList.add('hidden');
      $('tradeForm').reset();
      $('tradeId').value = '';
      $('formError').classList.add('hidden');
      drawMode = false;
      setDirection('Long');
    }

    function showError(message) {
      $('formError').textContent = message;
      $('formError').classList.remove('hidden');
    }

    function saveTrade(event) {
      event.preventDefault();
      const pair = $('pair').value.trim().toUpperCase();
      const date = $('date').value;
      if (!pair) return showError('Add a market or pair before saving.');
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return showError('Choose a valid date.');
      const actualPips = drawMode ? 0 : numberFrom('actual');
      if (!drawMode && actualPips === null) return showError('Enter the actual result in pips. Use a minus sign for a loss.');
      const sl = drawMode ? null : numberFrom('sl');
      const tp1 = drawMode ? null : numberFrom('tp1');
      const tp2 = drawMode ? null : numberFrom('tp2');
      const tp3 = drawMode ? null : numberFrom('tp3');
      if ([sl,tp1,tp2,tp3].some(n => n !== null && n < 0)) return showError('Stop loss and take-profit values must be zero or greater.');
      const idValue = $('tradeId').value;
      const trade = {
        id: idValue ? Number(idValue) : Date.now(), date, pair,
        direction: drawMode ? null : direction,
        entry: drawMode ? null : numberFrom('entry'), sl, tp1, tp2, tp3,
        actualPips, isDraw: drawMode, notes: $('notes').value.trim()
      };
      if (idValue) trades = trades.map(item => String(item.id) === idValue ? trade : item);
      else trades.unshift(trade);
      if (!saveTrades()) return;
      closeForm();
      render();
    }

    function filteredTrades() {
      let list = [...trades];
      const now = new Date();
      if (activeFilter === 'week' || activeFilter === 'month') {
        const days = activeFilter === 'week' ? 7 : 30;
        const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
        list = list.filter(t => new Date(`${t.date}T00:00:00`) >= cutoff);
      } else if (activeFilter === 'year') {
        list = list.filter(t => Number(t.date.slice(0, 4)) === now.getFullYear());
      } else if (activeFilter === 'custom' && customStart && customEnd) {
        list = list.filter(t => t.date >= customStart && t.date <= customEnd);
      }
      return list.sort((a,b) => b.date.localeCompare(a.date) || Number(b.id) - Number(a.id));
    }

    function formatPips(value, signed = false) {
      const n = Number(value) || 0;
      return `${signed && n > 0 ? '+' : ''}${Number(n.toFixed(1))}`;
    }

    function renderStats(list) {
      const entered = list.filter(t => !t.isDraw);
      const wins = entered.filter(t => t.actualPips > 0);
      const losses = entered.filter(t => t.actualPips < 0);
      const breakeven = entered.filter(t => t.actualPips === 0);
      const net = entered.reduce((sum,t) => sum + t.actualPips, 0);
      const won = wins.reduce((sum,t) => sum + t.actualPips, 0);
      const lost = losses.reduce((sum,t) => sum + t.actualPips, 0);
      const avgWin = wins.length ? won / wins.length : null;
      const avgLoss = losses.length ? lost / losses.length : null;
      const winRate = entered.length ? (wins.length / entered.length) * 100 : null;
      const profitFactor = lost < 0 ? won / Math.abs(lost) : won > 0 ? Infinity : null;
      const stats = [
        ['Trades', entered.length, ''],
        ['Win rate', winRate === null ? '—' : `${winRate.toFixed(1)}%`, ''],
        ['Net pips', formatPips(net, true), net > 0 ? 'positive' : net < 0 ? 'negative' : ''],
        ['Profit factor', profitFactor === null ? '—' : profitFactor === Infinity ? '∞' : profitFactor.toFixed(2), ''],
        ['Wins / losses', `${wins.length} / ${losses.length}`, ''],
        ['Avg. win / loss', `${avgWin === null ? '—' : formatPips(avgWin)} / ${avgLoss === null ? '—' : formatPips(avgLoss)}`, '']
      ];
      $('stats').innerHTML = stats.map(([label,value,klass]) => `<div class="stat"><div class="stat-label">${label}</div><div class="stat-value ${klass}">${value}</div></div>`).join('');
    }

    function escapeHTML(value) {
      return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    }

    function renderTrades(list) {
      $('tradeCount').textContent = `${list.length} ${list.length === 1 ? 'trade' : 'trades'}`;
      if (!list.length) {
        $('tradeList').innerHTML = `<div class="empty">No trades in this period.<br><span class="muted">Add a trade to start building your journal.</span></div>`;
        return;
      }
      $('tradeList').innerHTML = list.map(trade => {
        const resultClass = trade.isDraw ? 'draw' : trade.actualPips > 0 ? 'win' : trade.actualPips < 0 ? 'loss' : 'be';
        const resultText = trade.isDraw ? 'DRAW' : trade.actualPips > 0 ? 'WIN' : trade.actualPips < 0 ? 'LOSS' : 'BREAKEVEN';
        const pips = trade.isDraw ? '—' : formatPips(trade.actualPips, true);
        const directionTag = trade.direction ? `<span class="tag">${escapeHTML(trade.direction.toUpperCase())}</span>` : '';
        return `<article class="trade"><div class="trade-main"><div class="trade-pair">${escapeHTML(trade.pair)} ${directionTag}<span class="tag ${resultClass}">${resultText}</span></div><div class="trade-meta">${escapeHTML(trade.date)}${trade.notes ? ` · ${escapeHTML(trade.notes.slice(0,70))}${trade.notes.length > 70 ? '…' : ''}` : ''}</div><div class="trade-tools"><button class="small-btn" data-edit="${escapeHTML(trade.id)}">Edit</button><button class="small-btn" data-delete="${escapeHTML(trade.id)}">Delete</button></div></div><div class="trade-result"><div class="trade-pips ${trade.isDraw ? '' : trade.actualPips > 0 ? 'positive' : trade.actualPips < 0 ? 'negative' : 'neutral'}">${pips}</div><div class="trade-meta">${trade.isDraw ? 'no entry' : 'pips'}</div></div></article>`;
      }).join('');
    }

    function render() {
      const list = filteredTrades();
      renderStats(list);
      renderTrades(list);
      document.querySelectorAll('[data-filter]').forEach(button => button.classList.toggle('active', button.dataset.filter === activeFilter));
    }

    function requestDelete(id) {
      pendingDeleteId = id;
      $('confirmDialog').classList.remove('hidden');
      $('confirmDeleteBtn').focus();
    }

    function cancelDelete() {
      pendingDeleteId = null;
      $('confirmDialog').classList.add('hidden');
    }

    function confirmDelete() {
      if (pendingDeleteId === null) return;
      const previous = trades;
      trades = trades.filter(t => String(t.id) !== String(pendingDeleteId));
      if (!saveTrades()) { trades = previous; return; }
      cancelDelete();
      render();
    }

    $('newTradeBtn').addEventListener('click', () => showForm(false));
    $('newDrawBtn').addEventListener('click', () => showForm(true));
    $('closeFormBtn').addEventListener('click', closeForm);
    $('cancelBtn').addEventListener('click', closeForm);
    $('tradeForm').addEventListener('submit', saveTrade);
    document.querySelectorAll('[data-direction]').forEach(button => button.addEventListener('click', () => setDirection(button.dataset.direction)));
    document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
      activeFilter = button.dataset.filter;
      $('customRange').classList.toggle('hidden', activeFilter !== 'custom');
      render();
    }));
    $('applyRangeBtn').addEventListener('click', () => {
      customStart = $('fromDate').value;
      customEnd = $('toDate').value;
      if (!customStart || !customEnd) return alert('Choose both dates for the custom range.');
      if (customStart > customEnd) return alert('The start date must be before the end date.');
      activeFilter = 'custom';
      render();
    });
    $('tradeList').addEventListener('click', event => {
      const editButton = event.target.closest('[data-edit]');
      const deleteButton = event.target.closest('[data-delete]');
      if (editButton) {
        const trade = trades.find(t => String(t.id) === editButton.dataset.edit);
        if (trade) showForm(Boolean(trade.isDraw), trade);
      }
      if (deleteButton) requestDelete(deleteButton.dataset.delete);
    });
    $('keepTradeBtn').addEventListener('click', cancelDelete);
    $('confirmDeleteBtn').addEventListener('click', confirmDelete);
    $('confirmDialog').addEventListener('click', event => { if (event.target === $('confirmDialog')) cancelDelete(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') { cancelDelete(); if (!$('formPanel').classList.contains('hidden')) closeForm(); } });

    render();
