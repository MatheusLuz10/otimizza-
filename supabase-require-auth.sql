-- ═════════════════════════════════════════════════════════════════
-- OTIMIZZA PRED - Exigir login para acessar os dados
--
-- Este script é 100% ADITIVO e seguro para rodar quantas vezes
-- precisar:
--   - Não usa "drop table" nem "truncate"
--   - Os únicos "drop" são de POLICIES (regras de acesso), que
--     nunca apagam uma linha de buildings/ctos/audit_logs
--
-- O que ele faz: troca as regras de "qualquer um com a chave anon
-- pode ler/gravar" por "só quem estiver autenticado (logado) pode
-- ler/gravar". Depois de rodar isso, é obrigatório estar logado no
-- Supabase Auth para o app funcionar.
--
-- Rode DEPOIS de já ter aplicado o supabase-schema.sql.
-- ═════════════════════════════════════════════════════════════════

-- buildings
drop policy if exists "allow_public_buildings_select" on buildings;
drop policy if exists "allow_public_buildings_insert" on buildings;
drop policy if exists "allow_public_buildings_update" on buildings;
drop policy if exists "allow_public_buildings_delete" on buildings;
drop policy if exists "authenticated_buildings_select" on buildings;
drop policy if exists "authenticated_buildings_insert" on buildings;
drop policy if exists "authenticated_buildings_update" on buildings;
drop policy if exists "authenticated_buildings_delete" on buildings;

create policy "authenticated_buildings_select"
  on buildings for select using (auth.role() = 'authenticated');
create policy "authenticated_buildings_insert"
  on buildings for insert with check (auth.role() = 'authenticated');
create policy "authenticated_buildings_update"
  on buildings for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_buildings_delete"
  on buildings for delete using (auth.role() = 'authenticated');

-- ctos
drop policy if exists "allow_public_ctos_select" on ctos;
drop policy if exists "allow_public_ctos_insert" on ctos;
drop policy if exists "allow_public_ctos_update" on ctos;
drop policy if exists "allow_public_ctos_delete" on ctos;
drop policy if exists "authenticated_ctos_select" on ctos;
drop policy if exists "authenticated_ctos_insert" on ctos;
drop policy if exists "authenticated_ctos_update" on ctos;
drop policy if exists "authenticated_ctos_delete" on ctos;

create policy "authenticated_ctos_select"
  on ctos for select using (auth.role() = 'authenticated');
create policy "authenticated_ctos_insert"
  on ctos for insert with check (auth.role() = 'authenticated');
create policy "authenticated_ctos_update"
  on ctos for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_ctos_delete"
  on ctos for delete using (auth.role() = 'authenticated');

-- audit_logs (continua imutável: sem policy de update/delete)
drop policy if exists "allow_public_audit_select" on audit_logs;
drop policy if exists "allow_public_audit_insert" on audit_logs;
drop policy if exists "authenticated_audit_select" on audit_logs;
drop policy if exists "authenticated_audit_insert" on audit_logs;

create policy "authenticated_audit_select"
  on audit_logs for select using (auth.role() = 'authenticated');
create policy "authenticated_audit_insert"
  on audit_logs for insert with check (auth.role() = 'authenticated');
