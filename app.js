/* NutriTrend Sentinel dashboard — vanilla JS, no dependencies. */
(function () {
  "use strict";

  var DATA = null;
  var DASH = "—";
  var STATUS_LABEL = { HIT: "Acerto", PARTIAL: "Parcial", MISS: "Erro", ANALYZING: "Analisando", INCONCLUSIVE: "Analisando", PENDING: "Analisando", OVERDUE: "Atrasado" };
  var VALUE_LABEL = { frozen: "congelada", frozen_unchanged: "congelada (inalterada)", "Daily Alert": "Alerta diário" };
  var OBS_KEY_LABEL = {
    stage: "Estágio", stage_now: "Estágio atual", alert_level: "Nível de alerta", x_counts: "Contagens no X",
    brazil_relevance: "Relevância para o Brasil", niche: "Nichos", confidence: "Confiança",
    recommended_action: "Ação recomendada", deeper_chatgpt_analysis_warranted: "Análise aprofundada necessária?",
    prediction_status: "Status da previsão", source_scans: "Varreduras de origem", related_new_cohort: "Nova coorte relacionada",
    why_flagged: "Por que foi sinalizada", predicted_trajectory: "Trajetória prevista", prediction_timeframe: "Horizonte",
    prediction_confidence: "Confiança da previsão", prediction_freeze_date: "Data de congelamento", brazil_presence: "Presença no Brasil",
    brazil_momentum: "Momentum no Brasil", evidence_temperature: "Temperatura da evidência", misinformation_risk: "Risco de desinformação",
    velocity: "Velocidade", key_sources: "Fontes-chave", ProfileA_relevance: "Relevância Perfil A", ProfileB_relevance: "Relevância Perfil B",
    file: "Arquivo"
  };
  var LANG = "pt"; // detail panel language: "pt" (tradução) or "en" (original)
  var STATUS_ORDER = { HIT: 0, PARTIAL: 1, MISS: 2, ANALYZING: 3 };
  var HORIZON_LABEL = { plus_7: "+7", plus_14: "+14", plus_30: "+30" };
  var OBS_TYPE_LABEL = {
    initial_cohort_freeze: "Congelamento na coorte",
    weekly_cohort_propagation: "Propagação semanal",
    plus7_review_probe: "Sondagem +7",
    plus14_review_probe: "Sondagem +14",
    plus30_review_probe: "Sondagem +30",
    daily_radar_alert: "Alerta diário",
    daily_radar_propagation: "Propagação diária",
    x_propagation_probe: "Sondagem no X"
  };

  // Frozen-prediction field groups (labels in pt-BR). Unknown fields go to "Outros campos".
  var GROUPS = [
    ["Sinal e estágio", [
      ["stage", "Estágio"], ["velocity", "Velocidade"], ["reach", "Alcance"], ["novelty", "Novidade"],
      ["persistence_estimate", "Persistência estimada"], ["evidence_temperature", "Temperatura da evidência"],
      ["misinformation_risk", "Risco de desinformação"], ["audience_question_signal", "Perguntas do público"],
      ["content_opportunity", "Oportunidade de conteúdo"]]],
    ["Brasil", [["brazil_presence", "Presença no Brasil"], ["brazil_momentum", "Momentum no Brasil"],
      ["ProfileA_relevance", "Relevância Perfil A (Esportiva/Hipertrofia)"], ["ProfileB_relevance", "Relevância Perfil B (Suplementos)"]]],
    ["Origem", [["source_market", "Mercado de origem"], ["origin_community", "Comunidade de origem"],
      ["origin_type", "Tipo de origem"], ["source_layer", "Camada do radar"],
      ["first_detected_date", "Primeira detecção"], ["latest_observation_date", "Última observação (registro)"]]],
    ["Justificativa", [["why_flagged", "Por que foi sinalizada"], ["scan_notes", "Notas de varredura"],
      ["merged_from", "Mesclada de"], ["primary_niches", "Nichos principais"], ["key_accounts", "Contas-chave"]]],
    ["Metadados", [["trend_id", "ID da tendência"], ["cohort_id", "Coorte"], ["prediction_status", "Status da previsão"],
      ["prediction_freeze_date", "Data de congelamento"], ["next_review_date", "Próxima revisão (registro)"],
      ["review_dates", "Datas de revisão"], ["Radar_version", "Versão do Radar"], ["Score_version", "Versão do Score"]]]
  ];
  var SPECIAL = ["topic", "canonical_topic_name", "predicted_trajectory", "prediction_confidence", "prediction_timeframe", "key_sources", "observation_log"];

  // ---------- helpers ----------
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function isEmpty(v) {
    return v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0) ||
      (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0);
  }
  function linkify(text) {
    return esc(text).replace(/https?:\/\/[^\s<>"')\]]+/g, function (u) {
      return '<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + u + "</a>";
    });
  }
  function txt(v) { return isEmpty(v) ? DASH : linkify(v); }
  function fmtDate(iso) {
    if (!iso) return DASH;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    return m ? m[3] + "/" + m[2] + "/" + m[1] : esc(iso);
  }
  function pct(x) { return x === null || x === undefined ? DASH : (x * 100).toFixed(1).replace(".", ",") + "%"; }
  function cohortLabel(cid) {
    var m = /cohort_0*(\d+)/.exec(cid || "");
    return m ? "Coorte " + String(m[1]).padStart(3, "0") : (cid || DASH);
  }
  function sourceItem(s) {
    if (typeof s !== "string") return "<li>" + renderValue(s) + "</li>";
    if (/^https?:\/\//.test(s)) {
      var host = s.replace(/^https?:\/\/(www\d?\.)?/, "").split("/")[0];
      return '<li><a href="' + esc(s) + '" target="_blank" rel="noopener noreferrer">' + esc(host) + '</a> <span class="muted small">' + esc(s) + "</span></li>";
    }
    var local = s.replace(/^file:\/\/\/workspace\/nutritrend\//, "");
    return '<li><code>' + esc(local) + '</code> <span class="muted small">(arquivo do store)</span></li>';
  }
  function sourcesList(arr) {
    if (isEmpty(arr)) return '<p class="muted">' + DASH + "</p>";
    return '<ul class="links">' + arr.map(sourceItem).join("") + "</ul>";
  }
  function renderValue(v) {
    if (isEmpty(v)) return DASH;
    if (Array.isArray(v)) {
      if (v.every(function (x) { return typeof x !== "object"; })) {
        if (v.some(function (x) { return /^(https?|file):\/\//.test(String(x)); })) return sourcesList(v);
        return '<div class="tags">' + v.map(function (x) { return '<span class="tag">' + esc(x) + "</span>"; }).join("") + "</div>";
      }
      return v.map(renderValue).join("<hr>");
    }
    if (typeof v === "object") {
      return '<dl class="kv">' + Object.keys(v).map(function (k) {
        return "<dt>" + esc(HORIZON_LABEL[k] || k) + "</dt><dd>" + (/^\d{4}-\d{2}-\d{2}$/.test(v[k]) ? fmtDate(v[k]) : renderValue(v[k])) + "</dd>";
      }).join("") + "</dl>";
    }
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return fmtDate(v);
    return linkify(v);
  }
  function badge(status, extra) {
    return '<span class="badge b-' + esc(status) + '">' + esc(STATUS_LABEL[status] || status) + (extra ? " " + esc(extra) : "") + "</span>";
  }
  function F(t, lang) { return (lang || "pt") === "en" ? t.frozen : (t.frozen_pt || t.frozen); }
  function withPt(rec, lang) { return lang === "en" || !rec._pt ? rec : Object.assign({}, rec, rec._pt); }
  function valLabel(v) { return typeof v === "string" && VALUE_LABEL[v] ? VALUE_LABEL[v] : v; }
  function confNum(t) { var m = /(\d+)/.exec(t.frozen.prediction_confidence || ""); return m ? +m[1] : -1; }

  // ---------- header / cohorts ----------
  function renderHeader() {
    var o = DATA.overall;
    $("kpi-rate").textContent = pct(o.hit_rate);
    $("kpi-strict").textContent = "estrita " + pct(o.strict_hit_rate);
    $("kpi-hit").textContent = o.counts.HIT;
    $("kpi-partial").textContent = o.counts.PARTIAL;
    $("kpi-miss").textContent = o.counts.MISS;
    $("kpi-analyzing").textContent = o.counts.ANALYZING;
    var formulaTitle = "Taxa de acerto = (Acertos + 0,5×Parciais) ÷ (Acertos + Parciais + Erros)\nEstrita = Acertos ÷ (Acertos + Parciais + Erros)\nVeredito mais recente de cada tendência. “Analisando” fica fora do denominador.";
    document.querySelector(".kpi-main").title = formulaTitle;
    var d = new Date(DATA.generated_at);
    var s = isNaN(d) ? DATA.generated_at : d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "long", timeStyle: "short" });
    $("updated").textContent = s + " (horário de Brasília, America/Sao_Paulo)";
    if (DATA.warnings && DATA.warnings.length) $("warnings").textContent = "Avisos do build: " + DATA.warnings.join(" · ");
  }

  function bar(c, total) {
    function seg(k, cls) { return c[k] ? '<span class="' + cls + '" style="width:' + (100 * c[k] / total) + '%"></span>' : ""; }
    return '<div class="bar" aria-hidden="true">' + seg("HIT", "hit") + seg("PARTIAL", "partial") + seg("MISS", "miss") + seg("ANALYZING", "analyzing") + "</div>";
  }

  function renderCohorts() {
    var sel = $("f-cohort");
    $("cohorts").innerHTML = DATA.cohorts.map(function (c) {
      var s = c.summary, n = s.counts;
      var opt = document.createElement("option");
      opt.value = c.cohort_id; opt.textContent = cohortLabel(c.cohort_id) + " · " + fmtDate(c.frozen_date);
      sel.appendChild(opt);
      return '<article class="card cohort" tabindex="0" data-cohort="' + esc(c.cohort_id) + '" title="Filtrar por esta coorte">' +
        '<h3>' + esc(cohortLabel(c.cohort_id)) + '</h3>' +
        '<div class="muted small">Congelada em ' + fmtDate(c.frozen_date) + " · " + s.total + " previsões · " + c.reviews_count + " revisões</div>" +
        '<div class="rate">' + pct(s.hit_rate) + ' <small>acerto · estrita ' + pct(s.strict_hit_rate) + "</small></div>" +
        bar(n, s.total || 1) +
        '<div class="counts"><span><i class="dot hit"></i> Acerto ' + n.HIT + '</span><span><i class="dot partial"></i> Parcial ' + n.PARTIAL +
        '</span><span><i class="dot miss"></i> Erro ' + n.MISS + '</span><span><i class="dot analyzing"></i> Analisando ' + n.ANALYZING + "</span></div>" +
        '<div class="meta-row"><span>Próxima revisão</span><strong>' + fmtDate(c.next_review_date) + "</strong></div>" +
        (c.overdue ? '<div class="meta-row"><span>Checkpoints atrasados</span><strong style="color:var(--overdue)">' + c.overdue + "</strong></div>" : "") +
        "</article>";
    }).join("");
    Array.prototype.forEach.call(document.querySelectorAll(".cohort"), function (el) {
      function act() { sel.value = sel.value === el.dataset.cohort ? "" : el.dataset.cohort; applyFilters(); }
      el.addEventListener("click", act);
      el.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act(); } });
    });
  }

  // ---------- trend cards ----------
  function checkpoint(cp) {
    var h = HORIZON_LABEL[cp.horizon] || cp.horizon;
    if (cp.state === "scored") {
      return '<div class="cp scored r-' + esc(cp.result) + '" title="Revisado em ' + fmtDate(cp.review_date) + '"><b>' + esc(h) + '</b><span class="v">' +
        esc(STATUS_LABEL[cp.result] || cp.result) + '</span><span class="muted">' + fmtDate(cp.review_date) + "</span></div>";
    }
    var over = cp.state === "overdue";
    return '<div class="cp ' + (over ? "overdue" : "pending") + '"><b>' + esc(h) + '</b><span class="v">' + (over ? "Atrasado" : "Pendente") +
      '</span><span class="muted">' + fmtDate(cp.due) + "</span></div>";
  }

  function trendCard(t) {
    var f = F(t, "pt");
    var tags = '<span class="tag cohort-tag">' + esc(cohortLabel(t.cohort_id)) + "</span>";
    (f.primary_niches || []).slice(0, 4).forEach(function (n) { tags += '<span class="tag">' + esc(n) + "</span>"; });
    if ((f.primary_niches || []).length > 4) tags += '<span class="tag">+' + (f.primary_niches.length - 4) + "</span>";
    if (f.ProfileA_relevance !== undefined) tags += '<span class="tag prof" title="Relevância Perfil A (Esportiva/Hipertrofia)">A ' + esc(f.ProfileA_relevance) + "</span>";
    if (f.ProfileB_relevance !== undefined) tags += '<span class="tag prof" title="Relevância Perfil B (Suplementos)">B ' + esc(f.ProfileB_relevance) + "</span>";
    var alert = t.observations.some(function (o) { return o.observation_type === "daily_radar_alert"; });
    return '<article class="card trend s-' + t.status + '" tabindex="0" role="button" data-id="' + esc(t.id) + '" aria-label="Abrir ' + esc(t.id) + '">' +
      '<div class="trend-top"><span class="tid">' + esc(t.id) + "</span>" +
      (alert ? '<span class="badge b-OVERDUE" title="Há um alerta diário ligado a esta tendência">⚑ Alerta</span>' : "") +
      badge(t.status) + "</div>" +
      "<h3>" + esc(f.topic || f.canonical_topic_name || t.id) + "</h3>" +
      (f.canonical_topic_name ? '<p class="sub">' + esc(f.canonical_topic_name) + "</p>" : "") +
      '<div class="tags">' + tags + "</div>" +
      '<div class="muted small">Estágio: ' + esc(f.stage || DASH) + " · Confiança " + esc(f.prediction_confidence || DASH) + " · Congelada " + fmtDate(f.prediction_freeze_date) + "</div>" +
      '<div class="timeline">' + t.timeline.map(checkpoint).join("") + "</div>" +
      "</article>";
  }

  function searchable(t) {
    if (!t._search) {
      var f = t.frozen, p = t.frozen_pt || {};
      t._search = [t.id, p.topic, p.canonical_topic_name, p.stage, p.predicted_trajectory, p.why_flagged, (p.primary_niches || []).join(" "),
        t.reviews.map(function (r) { var x = r._pt || {}; return (STATUS_LABEL[r.result] || "") + " " + (x.rationale || "") + " " + (x.evidence_summary || ""); }).join(" "),
        t.observations.map(function (o) { var x = o._pt || {}; return (x.evidence_notes || "") + " " + (x.notes || ""); }).join(" "),
        f.topic, f.canonical_topic_name, f.stage, f.predicted_trajectory, f.why_flagged,
        (f.primary_niches || []).join(" "), (f.key_accounts || []).join(" "), (f.key_sources || []).join(" "),
        (f.merged_from || []).join(" "), f.source_market, f.origin_community,
        t.reviews.map(function (r) { return (r.result || "") + " " + (r.rationale || "") + " " + (r.evidence_summary || ""); }).join(" "),
        t.observations.map(function (o) { return (o.evidence_notes || "") + " " + (o.notes || ""); }).join(" ")
      ].join(" ").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }
    return t._search;
  }

  function applyFilters() {
    var q = $("f-q").value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    var cohort = $("f-cohort").value, status = $("f-status").value, sort = $("f-sort").value;
    var list = DATA.trends.filter(function (t) {
      if (cohort && t.cohort_id !== cohort) return false;
      if (status && t.status !== status) return false;
      if (q && q.split(/\s+/).some(function (w) { return searchable(t).indexOf(w) === -1; })) return false;
      return true;
    });
    list.sort(function (a, b) {
      if (sort === "status") return (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) || (b.id < a.id ? -1 : 1);
      if (sort === "confidence") return (confNum(b) - confNum(a)) || (b.id < a.id ? -1 : 1);
      if (sort === "oldest") return a.id < b.id ? -1 : 1;
      return b.id < a.id ? -1 : 1; // newest: IDs encode freeze date + sequence
    });
    $("trends").innerHTML = list.length ? list.map(trendCard).join("") : '<p class="empty">Nenhuma tendência encontrada com esses filtros.</p>';
    $("result-count").textContent = "(" + list.length + " de " + DATA.trends.length + ")";
    Array.prototype.forEach.call(document.querySelectorAll(".cohort"), function (el) {
      el.classList.toggle("active", el.dataset.cohort === cohort);
    });
    try {
      sessionStorage.setItem("nt-filters", JSON.stringify({ q: $("f-q").value, cohort: cohort, status: status, sort: sort }));
    } catch (e) { /* ignore */ }
  }

  // ---------- detail modal ----------
  function reviewBlock(r0, lang) {
    var r = withPt(r0, lang);
    var xc = "";
    if (r.x_counts && !isEmpty(r.x_counts)) {
      xc = '<div class="label">Contagens no X</div><div class="xcounts">' + Object.keys(r.x_counts).map(function (k) {
        return '<span class="tag mono">' + esc(k) + ": " + esc(r.x_counts[k]) + "</span>";
      }).join("") + "</div>";
    }
    return '<div class="review"><div class="review-head"><h4>' + esc(HORIZON_LABEL[r.review_horizon] || r.review_horizon || DASH) +
      " · revisado em " + fmtDate(r.review_date) + "</h4>" + badge(r.result || "PENDING") + "</div>" +
      '<div class="label">Justificativa</div><p>' + txt(r.rationale) + "</p>" +
      '<div class="label">Evidências</div><p>' + txt(r.evidence_summary) + "</p>" + xc +
      '<details><summary>Fontes verificadas (' + (r.sources_checked || []).length + ")</summary>" + sourcesList(r.sources_checked) + "</details>" +
      '<p class="muted small">' + esc(r.review_id || DASH) + " · " + esc(r._source_file || "") + " · fuso " + esc(r.timezone || DASH) + "</p></div>";
  }

  function obsBlock(o0, lang) {
    var o = withPt(o0, lang);
    var type = o.observation_type || o.type;
    var isAlert = type === "daily_radar_alert";
    var skip = { observation_date: 1, date: 1, trend_id: 1, cohort_id: 1, observation_type: 1, type: 1, Radar_version: 1, Score_version: 1, evidence_notes: 1, notes: 1, note: 1, summary: 1, sources_found: 1 };
    var rest = Object.keys(o).filter(function (k) { return !skip[k] && k.charAt(0) !== "_" && !isEmpty(o[k]); });
    var body = "";
    if (o.evidence_notes) body += '<div class="label">Evidências</div><p>' + linkify(o.evidence_notes) + "</p>";
    if (o.notes || o.note || o.summary) body += '<div class="label">Notas</div><p>' + linkify(o.notes || o.note || o.summary) + "</p>";
    if (!isEmpty(o.sources_found)) body += '<div class="label">Fontes</div>' + sourcesList(o.sources_found);
    if (rest.length) {
      body += "<details" + (isAlert ? " open" : "") + "><summary>Outros campos (" + rest.length + ")</summary>" +
        '<dl class="kv">' + rest.map(function (k) { return "<dt>" + esc(OBS_KEY_LABEL[k] || k) + "</dt><dd>" + renderValue(valLabel(o[k])) + "</dd>"; }).join("") + "</dl></details>";
    }
    return '<div class="obs' + (isAlert ? " alert" : "") + '"><div class="obs-head"><h4>' + fmtDate(o.observation_date || o.date) + " · " +
      esc(OBS_TYPE_LABEL[type] || type || DASH) + "</h4>" + (o.alert_level ? '<span class="badge b-OVERDUE">⚑ ' + esc(valLabel(o.alert_level)) + "</span>" : "") +
      "</div>" + body + (o._source_file ? '<p class="muted small">' + esc(o._source_file) + (o._line ? ":" + o._line : "") + "</p>" : "") + "</div>";
  }

  function openDetail(id, push, keepScroll) {
    var t = DATA.trends.find(function (x) { return x.id === id; });
    if (!t) return;
    var lang = LANG;
    var f = F(t, lang);
    var hasPt = !!t.translation;
    var used = {};
    SPECIAL.forEach(function (k) { used[k] = 1; });
    var groups = GROUPS.map(function (g) {
      var rows = g[1].map(function (p) { used[p[0]] = 1; return "<dt>" + esc(p[1]) + "</dt><dd>" + (p[0] === "cohort_id" ? esc(cohortLabel(f[p[0]])) : renderValue(valLabel(f[p[0]]))) + "</dd>"; }).join("");
      return "<h3>" + esc(g[0]) + '</h3><dl class="kv">' + rows + "</dl>";
    }).join("");
    var extra = Object.keys(f).filter(function (k) { return !used[k]; });
    var extraHtml = extra.length ? '<h3>Outros campos</h3><dl class="kv">' + extra.map(function (k) {
      return "<dt>" + esc(k) + "</dt><dd>" + renderValue(f[k]) + "</dd>"; }).join("") + "</dl>" : "";
    var embedded = (lang === "en" ? t.embedded_observation_log : (f.observation_log || t.embedded_observation_log)) || [];
    var obsCount = t.observations.length + embedded.length;
    var mentions = t.mentions.length ? "<h4 style=\"margin-top:12px\">Citada em observações de outras tendências</h4><ul class=\"links\">" + t.mentions.map(function (m) {
      return '<li>' + fmtDate(m.observation_date) + " · " + esc(OBS_TYPE_LABEL[m.observation_type] || m.observation_type || DASH) + " · " +
        (m.from_trend_id ? '<a href="#' + esc(m.from_trend_id) + '">' + esc(m.from_trend_id) + "</a>" : "observação geral") + ' <span class="muted small">' + esc(m._source_file) + "</span></li>";
    }).join("") + "</ul>" : "";

    $("m-body").innerHTML =
      '<div class="trend-top" style="justify-content:flex-start;gap:10px"><span class="tid">' + esc(t.id) + '</span><span class="tag cohort-tag">' +
      esc(cohortLabel(t.cohort_id)) + "</span>" + badge(t.status) +
      '<button type="button" class="btn ghost lang-toggle" id="m-lang" aria-pressed="' + (lang === "en") + '">' +
      (lang === "en" ? "ver em português" : "ver original (EN)") + "</button></div>" +
      (lang === "en" ? '<p class="lang-note">Exibindo o texto original em inglês, exatamente como foi congelado/registrado.</p>' :
        (hasPt ? "" : '<p class="lang-note">Tradução PT-BR indisponível para esta previsão — exibindo o original.</p>')) +
      '<h2 id="m-title">' + esc(f.topic || t.id) + "</h2>" +
      (f.canonical_topic_name ? '<p class="muted" style="margin:0">' + esc(f.canonical_topic_name) + "</p>" : "") +
      '<div class="prediction"><div class="label">Previsão congelada em ' + fmtDate(f.prediction_freeze_date) + "</div>" +
      "<p><strong>" + txt(f.predicted_trajectory) + "</strong></p>" +
      '<p class="small">Confiança: <strong>' + esc(f.prediction_confidence || DASH) + "</strong> · Horizonte: " + esc(f.prediction_timeframe || DASH) + "</p></div>" +
      "<h3>Linha do tempo de revisões</h3><div class=\"timeline\">" + t.timeline.map(checkpoint).join("") + "</div>" +
      "<h3>Revisões (" + t.reviews.length + ")</h3>" +
      (t.reviews.length ? t.reviews.slice().reverse().map(function (r) { return reviewBlock(r, lang); }).join("") : '<p class="muted">Ainda sem revisão. Próxima revisão: ' + fmtDate(t.next_checkpoint) + ".</p>") +
      "<h3>Observações relacionadas (" + obsCount + ")</h3>" +
      (obsCount ? t.observations.slice().reverse().map(function (o) { return obsBlock(o, lang); }).join("") + embedded.map(function (e) {
        return obsBlock(Object.assign({ _source_file: "trends/" + t.id + ".json (observation_log)" }, e), lang); }).join("") : '<p class="muted">' + DASH + "</p>") +
      mentions +
      "<h3>Fontes-chave</h3>" + sourcesList(f.key_sources) +
      groups + extraHtml;

    $("m-lang").addEventListener("click", function () {
      LANG = LANG === "en" ? "pt" : "en";
      openDetail(id, false, true);
      $("m-lang").focus();
    });
    var modal = $("modal");
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    if (!keepScroll) { modal.scrollTop = 0; modal.querySelector(".modal").focus(); }
    if (push !== false && location.hash !== "#" + id) history.pushState(null, "", "#" + id);
    document.title = "Dashboard";
  }

  var lastFocus = null;
  function closeDetail(fromHash) {
    var modal = $("modal");
    if (modal.hidden) return;
    modal.hidden = true;
    LANG = "pt";
    document.body.style.overflow = "";
    document.title = "Dashboard";
    if (!fromHash && location.hash) history.pushState(null, "", location.pathname + location.search);
    if (lastFocus) { try { lastFocus.focus(); } catch (e) { /* ignore */ } }
  }

  function routeHash() {
    var id = decodeURIComponent(location.hash.replace(/^#/, ""));
    if (/^NT-/.test(id)) openDetail(id, false); else closeDetail(true);
  }

  // ---------- init ----------
  function bind() {
    ["f-q", "f-cohort", "f-status", "f-sort"].forEach(function (id) {
      $(id).addEventListener(id === "f-q" ? "input" : "change", applyFilters);
    });
    $("f-reset").addEventListener("click", function () {
      $("f-q").value = ""; $("f-cohort").value = ""; $("f-status").value = ""; $("f-sort").value = "newest"; applyFilters();
    });
    $("trends").addEventListener("click", function (e) {
      var card = e.target.closest(".trend");
      if (card) { lastFocus = card; openDetail(card.dataset.id); }
    });
    $("trends").addEventListener("keydown", function (e) {
      var card = e.target.closest(".trend");
      if (card && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); lastFocus = card; openDetail(card.dataset.id); }
    });
    $("modal").addEventListener("click", function (e) { if (e.target === $("modal")) closeDetail(); });
    $("m-close").addEventListener("click", function () { closeDetail(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeDetail(); });
    window.addEventListener("hashchange", routeHash);
    window.addEventListener("popstate", routeHash);
  }

  function restoreFilters() {
    try {
      var s = JSON.parse(sessionStorage.getItem("nt-filters") || "null");
      if (!s) return;
      $("f-q").value = s.q || ""; $("f-cohort").value = s.cohort || ""; $("f-status").value = s.status || ""; $("f-sort").value = s.sort || "newest";
    } catch (e) { /* ignore */ }
  }

  fetch("./data/data.json", { cache: "no-cache" })
    .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(function (d) {
      DATA = d;
      renderHeader();
      renderCohorts();
      bind();
      restoreFilters();
      applyFilters();
      routeHash();
    })
    .catch(function (err) {
      $("trends").innerHTML = '<p class="empty">Não foi possível carregar <code>data/data.json</code> (' + esc(err.message) +
        "). Rode <code>python3 build.py</code> e sirva a pasta via HTTP (ex.: <code>python3 -m http.server</code>).</p>";
    });
})();
