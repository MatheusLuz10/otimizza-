# CTO Manager PWA - Instruções de Desenvolvimento

## Visão Geral

Esta é uma aplicação PWA (Progressive Web App) para gerenciamento de prédios e caixas CTO de telecom, com funcionalidade offline-first e sincronização com Supabase.

## Arquitetura

### Frontend (React + Vite)
- **Framework**: React 18
- **Build**: Vite
- **Roteamento**: React Router v6
- **Banco Local**: IndexedDB (Dexie)
- **Sincronização**: Service Worker + Background Sync

### Backend (Supabase)
- **Banco de Dados**: PostgreSQL
- **API**: Supabase REST API
- **Autenticação**: Opcional (não implementada neste MVP)

## Setup

### Dependências
- Node.js 16+
- npm ou yarn

### Instalação

```bash
npm install
```

### Configuração de Ambiente

Crie um arquivo `.env.local`:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_KEY=sua-chave-publica-aqui
```

### Desenvolvimento

```bash
npm run dev
```

A aplicação estará disponível em `http://localhost:5173`

### Build para Produção

```bash
npm run build
```

## Estrutura de Diretórios

```
src/
├── pages/              # Componentes de página
│   ├── LoginPage.jsx
│   ├── LoginPage.css
│   ├── DashboardPage.jsx
│   ├── DashboardPage.css
│   ├── BuildingsPage.jsx
│   ├── BuildingsPage.css
│   ├── CTOsPage.jsx
│   ├── CTOsPage.css
│   ├── BuildingDetailPage.jsx
│   └── BuildingDetailPage.css
├── db/                 # Configuração do banco local
│   └── dexie.js       # Esquema IndexedDB
├── services/           # Serviços
│   ├── supabase.js    # Integração Supabase
│   └── sync.js        # Lógica de sincronização
├── App.jsx
├── App.css
├── main.jsx
└── index.css
public/
├── manifest.json      # PWA manifest
├── sw.js             # Service Worker
├── icons/            # Ícones PWA (criar manualmente)
└── screenshots/      # Screenshots (criar manualmente)
```

## Fluxo de Dados

1. **Login**: Nome e matrícula do técnico são salvos em IndexedDB
2. **Cadastro de Dados**: Dados salvos localmente com status `pending`
3. **Adição à Fila**: Operações adicionadas à `syncQueue`
4. **Sincronização**: Quando online, a fila é processada
5. **Atualização de Status**: Status muda para `synced` após sucesso

## API Endpoints (Supabase)

### Buildings
- `GET /rest/v1/buildings` - Listar prédios
- `POST /rest/v1/buildings` - Criar prédio
- `PUT /rest/v1/buildings?id=eq.{id}` - Atualizar
- `DELETE /rest/v1/buildings?id=eq.{id}` - Deletar

### CTOs
- `GET /rest/v1/ctos` - Listar caixas
- `POST /rest/v1/ctos` - Criar caixa
- `PUT /rest/v1/ctos?id=eq.{id}` - Atualizar
- `DELETE /rest/v1/ctos?id=eq.{id}` - Deletar

## Variáveis de Ambiente

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `VITE_SUPABASE_URL` | URL do projeto Supabase | `https://xxxxx.supabase.co` |
| `VITE_SUPABASE_KEY` | Chave pública Supabase | `ey...` |

## Desenvolvimento

### Adicionar Nova Página

1. Criar arquivo em `src/pages/NomePage.jsx`
2. Criar arquivo de estilos `src/pages/NomePage.css`
3. Importar em `App.jsx`
4. Adicionar rota em `<Routes>`

### Modificar Banco Local

Editar `src/db/dexie.js`:

```javascript
db.version(1).stores({
  novaTabela: '++id, campo1, campo2'
});
```

### Adicionar Novo Serviço

Criar novo arquivo em `src/services/`.

### Sincronização Customizada

Editar `src/services/sync.js` para adicionar novos tipos de entidade.

## Build e Deploy

### Build Local
```bash
npm run build
npm run preview
```

### Deploy (Exemplo: Netlify)

1. Conecte seu repositório Git
2. Configure build command: `npm run build`
3. Configure publish directory: `dist`
4. Adicione variáveis de ambiente
5. Deploy automático após push

### PWA Checklist

- ✅ `manifest.json` configurado
- ✅ Service Worker registrado
- ✅ HTTPS em produção (obrigatório)
- ✅ Ícones nos tamanhos corretos
- ✅ Theme color configurada

## Testes

Para testar modo offline:
1. Abra DevTools (F12)
2. Vá para a aba Network
3. Marque "Offline"
4. Navegue e realize operações
5. A sincronização ocorrerá quando desmarcar "Offline"

## Performance

- Cache de assets com Service Worker
- IndexedDB para queries rápidas
- Lazy loading automático do React
- CSS otimizado para mobile
- Compressão de imagens (quando adicionadas)

## Segurança

- Supabase Row Level Security recomendado
- Validação de entrada no frontend
- Sem senhas ou tokens no localStorage
- HTTPS obrigatório em produção

## Troubleshooting

### Port 5173 já está em uso
```bash
npm run dev -- --port 3000
```

### Limpiar cache do Service Worker
1. DevTools → Application → Storage
2. Clique em "Clear site data"
3. Recarregue a página

### IndexedDB corrompido
```javascript
// No console do navegador
indexedDB.deleteDatabase('CTOManagerDB');
location.reload();
```

## Próximas Melhorias

- [ ] Upload de imagens/documentos
- [ ] Geolocalização de prédios
- [ ] Ordens de serviço
- [ ] Autenticação segura
- [ ] Dashboard analítico
- [ ] Backup automático
- [ ] Notificações push
- [ ] Modo dark theme

## Recursos Úteis

- [Documentação React](https://react.dev)
- [Vite Guide](https://vitejs.dev)
- [Supabase Docs](https://supabase.com/docs)
- [Dexie.js](https://dexie.org)
- [PWA Checklist](https://web.dev/pwa-checklist/)

## Contato/Suporte

Referir ao repositório do projeto para issues e discussões.
