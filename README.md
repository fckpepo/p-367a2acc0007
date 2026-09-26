# NutriTrend Sentinel — dashboard estático

Painel estático (HTML + CSS + JS puro, sem build step e sem CDNs) que mostra as previsões
congeladas do NutriTrend Sentinel, as revisões +7/+14/+30 e as observações relacionadas.

## Como atualizar (após novas reviews/observações)

```bash
python3 build.py          # lê /workspace/nutritrend (somente leitura) e grava data/data.json
git add data/data.json && git commit -m "data: atualização $(date +%F)"
git push                  # GitHub Pages republica automaticamente
```

Opções: `python3 build.py --store /caminho/do/store --out data/data.json`
(ou variável `NUTRITREND_STORE`). Só usa a biblioteca padrão do Python 3.9+.

O build imprime a taxa de acerto geral/por coorte e avisos de inconsistência
(ex.: `schedule.last_result` diferente da última review).

## O que o build.py lê
- `trends/NT-*.json` — previsões congeladas (exibidas campo a campo; campos novos aparecem em “Outros campos”).
- `reviews/NT-*_plusN_DATA.json` — revisões; o veredito mais recente de cada trend define o status.
- `reviews/schedule_cohort_*.json` — calendário (+7/+14/+30) e data de cada coorte.
- `observations/*.jsonl` — observações append-only, associadas por `trend_id`
  (e também citações de IDs no texto de observações de outras trends). `observation_log` embutido no trend também é mostrado.

## Métricas
- **Taxa de acerto** = (HIT + 0,5 × PARTIAL) ÷ (HIT + PARTIAL + MISS)
- **Estrita** = HIT ÷ (HIT + PARTIAL + MISS)
- **Analisando** = último veredito INCONCLUSIVE ou ainda sem review (fora do denominador).
- Checkpoint sem review com data vencida aparece como “Atrasado”.

## Rodar localmente
```bash
python3 -m http.server 8000   # abra http://localhost:8000/
```
Deep link: `#NT-2026-09-14-01` abre o detalhe da trend. Todos os caminhos são relativos (funciona em subpasta do GitHub Pages).
`.nojekyll` desativa o Jekyll; `robots.txt` + meta `noindex` pedem que buscadores não indexem.
