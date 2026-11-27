#!/usr/bin/env bash
# Verifie la pile de supervision Docker : cibles Prometheus, regles, alertes actives,
# metriques cles et tableau de bord Grafana.
# Usage : scripts/check-monitoring.sh [prometheus_url] [grafana_url]
PROM="${1:-http://localhost:9090}"
GRAF="${2:-http://localhost:3001}"

q() { curl -s --get "$PROM/api/v1/query" --data-urlencode "query=$1" | grep -oE '"value":\[[^]]*\]' | head -1 | sed -E 's/.*,"([^"]*)"\]/\1/'; }

echo "Cibles :"
curl -s "$PROM/api/v1/targets?state=active" | grep -oE '"scrapePool":"[a-z]+"|"health":"[a-z]+"' | paste -d' ' - - | sed 's/"scrapePool":/  /; s/"health":/-> /'
echo "Regles chargees : $(curl -s "$PROM/api/v1/rules" | grep -oE '"type":"alerting"' | wc -l)"
echo "Alertes actives :"
curl -s "$PROM/api/v1/alerts" | grep -oE '"alertname":"[A-Za-z0-9]+"|"state":"[a-z]+"' | paste -d' ' - - | sed 's/"alertname":/  /; s/"state":/-> /'
echo "Requetes/s (1 min) : $(q 'sum(rate(http_requests_total[1m]))')"
echo "Latence p95 (s)    : $(q 'histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))')"
echo "MongoDB connecte   : $(q 'max(mongodb_up)')"
echo "Echecs connexion   : $(q 'sum(security_events_total{event="connexion_echec"})')"
echo "IP bloquees        : $(q 'sum(security_events_total{event="limite_atteinte"})')"
echo "Grafana sante      : $(curl -s "$GRAF/api/health" | grep -oE '"database": *"[a-z]+"')"
