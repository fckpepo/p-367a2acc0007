# Camada de tradução PT-BR — obrigatória para cada nova previsão/revisão

O painel é vendido ao mercado brasileiro: **todo texto de tendência, revisão e observação deve aparecer em português (PT-BR)**.
Os arquivos originais em `trends/`, `reviews/` e `observations/` são **congelados / somente acréscimo** — **nunca edite-os para traduzir**.
A tradução fica numa camada paralela, que o `build.py` mescla por cima do original na hora de exibir.

## Regra para rotinas futuras (cohort semanal, revisões +7/+14/+30, Daily Alerts)

Antes de rodar `python3 build.py`, para **cada arquivo novo** escreva o arquivo de tradução correspondente:

| Arquivo novo (original, congelado) | Tradução obrigatória |
|---|---|
| `trends/NT-AAAA-MM-DD-NN.json` | `translations/pt-BR/NT-AAAA-MM-DD-NN.json` |
| `reviews/NT-…_plusN_AAAA-MM-DD.json` | `translations/pt-BR/NT-…_plusN_AAAA-MM-DD.json` (mesmo nome) |
| linhas novas em `observations/AAAA-MM-DD.jsonl` | linhas em `translations/pt-BR/observations/AAAA-MM-DD.jsonl` (só acrescentar) |

### Formato — tendência
```json
{
  "source_file": "trends/NT-2026-09-28-01.json",
  "trend_id": "NT-2026-09-28-01",
  "language": "pt-BR",
  "translated_at": "2026-09-28T10:00:00-03:00",
  "topic": "…", "canonical_topic_name": "…", "predicted_trajectory": "…", "prediction_timeframe": "…",
  "source_market": "…", "origin_community": "…", "origin_type": "…", "source_layer": "…", "stage": "…",
  "velocity": "…", "reach": "…", "novelty": "…", "persistence_estimate": "…", "brazil_presence": "…",
  "brazil_momentum": "…", "evidence_temperature": "…", "misinformation_risk": "…",
  "audience_question_signal": "…", "content_opportunity": "…", "why_flagged": "…", "scan_notes": "…",
  "primary_niches": ["…"], "merged_from": ["…"], "key_accounts": ["…"]
}
```
Use as **mesmas chaves** do original (qualquer campo de texto novo, ex. ângulos/FAQs, também pode ser incluído com a mesma chave).
Listas precisam ter o **mesmo número de itens** do original (senão o build mantém o original).

### Formato — revisão
```json
{
  "source_file": "reviews/NT-2026-09-14-01_plus14_2026-09-28.json",
  "review_id": "NT-2026-09-14-01_plus14_2026-09-28",
  "trend_id": "NT-2026-09-14-01",
  "language": "pt-BR",
  "translated_at": "2026-09-28T10:00:00-03:00",
  "evidence_summary": "…", "rationale": "…",
  "frozen_predicted_trajectory": "…", "prediction_timeframe": "…"
}
```

### Formato — observação (uma linha JSON por linha do original)
```json
{"source_file": "observations/2026-09-28.jsonl", "line": 3, "trend_id": "NT-…", "observation_date": "2026-09-28",
 "observation_type": "daily_radar_alert", "translated_at": "2026-09-28T10:00:00-03:00",
 "fields": {"evidence_notes": "…", "notes": "…", "stage_now": "…", "recommended_action": "…"}}
```
O vínculo é pela linha (`line`, 1-based, contando só linhas não vazias do arquivo original) **e** confirmado por
`trend_id` + `observation_date` + `observation_type`; se a linha não bater, o build procura por essa tripla.

## Regras de tradução
- PT-BR natural e profissional, adequado a nutricionistas brasileiros; **não invente nem acrescente conteúdo**.
- **Manter inalterados:** IDs, datas, números, URLs, nomes de produtos/marcas/instituições, siglas de ensaios (NCT…, RE nº…),
  consultas/contagens do X e os valores de veredito dentro do texto (`HIT`, `PARTIAL`, `MISS`, `INCONCLUSIVE`).
- Texto que já está em português no original (ex.: perguntas do público) permanece igual.
- Registre sempre `source_file` e `translated_at` (ISO 8601, America/Sao_Paulo).

## Fluxo
```bash
# 1) a rotina grava o original congelado (trends/…, reviews/…, observations/…)
# 2) grava a tradução em translations/pt-BR/…
# 3) rebuild + publicação
cd /workspace/nutritrend-site
python3 build.py        # deve terminar com "Traduções PT-BR: 0 faltando"
git add data/data.json && git commit -m "data: atualização $(date +%F)" && git push
```
Se o build listar `AVISO: N arquivo(s) sem tradução PT-BR`, o site ainda funciona (mostra o original em inglês),
mas a tradução deve ser escrita e o build rodado de novo antes de publicar.
