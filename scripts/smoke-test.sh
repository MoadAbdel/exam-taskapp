#!/usr/bin/env bash
# Test de fumee de bout en bout d'un environnement deploye.
# Usage : scripts/smoke-test.sh https://exam-taskapp.vercel.app
# Verifie : sante, routage SPA, validation, auth par cookie, CRUD, IDOR, XSS, injection NoSQL, en-tetes.
set -uo pipefail

BASE="${1:?URL de base requise}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
RUN="$(date +%s)$RANDOM"
PASS=0
FAIL=0
JSON=(-H 'Content-Type: application/json')

check() { # check <nom> <attendu> <obtenu>
  if [[ "$3" == "$2" ]]; then
    PASS=$((PASS + 1)); echo "OK   $1 ($3)"
  else
    FAIL=$((FAIL + 1)); echo "FAIL $1 : attendu $2, obtenu $3"
  fi
}
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

check "sante API" 200 "$(code "$BASE/api/health")"
curl -s "$BASE/api/health"; echo
check "lien profond SPA /tasks" 200 "$(code "$BASE/tasks")"
check "inscription vide refusee" 400 "$(code "${JSON[@]}" -d '{}' "$BASE/api/auth/register")"
check "mot de passe faible refuse" 400 "$(code "${JSON[@]}" -d "{\"username\":\"w$RUN\",\"password\":\"123\"}" "$BASE/api/auth/register")"
check "inscription A" 201 "$(code -c "$TMP/a" "${JSON[@]}" -d "{\"username\":\"a$RUN\",\"password\":\"motdepasse1\"}" "$BASE/api/auth/register")"
check "inscription B" 201 "$(code -c "$TMP/b" "${JSON[@]}" -d "{\"username\":\"b$RUN\",\"password\":\"motdepasse1\"}" "$BASE/api/auth/register")"
check "cookie httpOnly" 1 "$(grep -c '#HttpOnly_' "$TMP/a")"
check "mauvais mot de passe" 401 "$(code "${JSON[@]}" -d "{\"username\":\"a$RUN\",\"password\":\"mauvais123\"}" "$BASE/api/auth/login")"
check "injection NoSQL refusee" 400 "$(code "${JSON[@]}" -d '{"username":{"$ne":null},"password":{"$ne":null}}' "$BASE/api/auth/login")"
check "taches sans session" 401 "$(code "$BASE/api/tasks")"

TASK="$(curl -s -b "$TMP/a" "${JSON[@]}" -d '{"title":"Tache de test"}' "$BASE/api/tasks")"
ID="$(echo "$TASK" | sed -n 's/.*"_id":"\([a-f0-9]\{24\}\)".*/\1/p')"
check "creation tache" 24 "${#ID}"
check "titre vide refuse" 400 "$(code -b "$TMP/a" "${JSON[@]}" -d '{"title":"  "}' "$BASE/api/tasks")"
check "XSS refuse" 400 "$(code -b "$TMP/a" "${JSON[@]}" -d "{\"title\":\"<script>alert('test')</script>\"}" "$BASE/api/tasks")"
check "IDOR modification par B" 404 "$(code -b "$TMP/b" -X PUT "${JSON[@]}" -d '{"title":"pirate"}' "$BASE/api/tasks/$ID")"
check "IDOR suppression par B" 404 "$(code -b "$TMP/b" -X DELETE "$BASE/api/tasks/$ID")"
check "B ne voit pas la tache de A" '[]' "$(curl -s -b "$TMP/b" "$BASE/api/tasks")"
check "A coche sa tache" 200 "$(code -b "$TMP/a" -X PUT "${JSON[@]}" -d '{"isCompleted":true}' "$BASE/api/tasks/$ID")"
check "A supprime sa tache" 200 "$(code -b "$TMP/a" -X DELETE "$BASE/api/tasks/$ID")"
check "deconnexion" 204 "$(code -b "$TMP/a" -c "$TMP/a" -X POST "$BASE/api/auth/logout")"
check "session fermee" 401 "$(code -b "$TMP/a" "$BASE/api/auth/me")"

HEADERS="$(curl -sI "$BASE/" | tr -d '\r')"
check "en-tete CSP" 1 "$(echo "$HEADERS" | grep -ci '^content-security-policy:')"
check "en-tete nosniff" 1 "$(echo "$HEADERS" | grep -ci '^x-content-type-options: nosniff')"
check "pas de X-Powered-By" 0 "$(curl -sI "$BASE/api/health" | grep -ci '^x-powered-by')"

echo "Resultat : $PASS OK, $FAIL echec(s)"
[[ $FAIL -eq 0 ]]
