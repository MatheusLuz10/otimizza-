# CTO Manager - PWA para Gerenciamento de Prédios e Caixas

Uma aplicação web progressiva (PWA) para gerenciamento de prédios e caixas CTO de telecom, com suporte offline-first e sincronização automática com Supabase.

## 🌟 Características

- ✅ **Offline-First**: Funciona completamente sem internet
- ✅ **Sincronização Automática**: Sincroniza dados com Supabase quando conectado
- ✅ **PWA**: Instalável como aplicativo nativo
- ✅ **Interface Mobile**: Otimizada para dispositivos móveis
- ✅ **IndexedDB**: Armazenamento local rápido com Dexie
- ✅ **Sem Autenticação Complexa**: Apenas nome e matrícula do técnico

## 🚀 Setup Rápido

### 1. Instalação

```bash
# Clone ou extraia o projeto
cd cto-manager-pwa

# Instale as dependências
npm install
```

### 2. Configuração do Supabase

1. Crie uma conta em [supabase.com](https://supabase.com)
2. Crie um novo projeto
3. Copie `.env.example` para `.env.local`
4. Adicione suas credenciais:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_KEY=sua-chave-publica-aqui
```

### 3. Criar Tabelas no Supabase

Acesse o SQL Editor do Supabase e execute:

```sql
-- Tabela de Prédios
CREATE TABLE buildings (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name VARCHAR NOT NULL,
  address VARCHAR,
  observations TEXT,
  created_by VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  sync_status VARCHAR DEFAULT 'synced',
  synced_at TIMESTAMP
);

-- Tabela de Caixas CTO
CREATE TABLE ctos (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  code VARCHAR NOT NULL UNIQUE,
  building_id BIGINT REFERENCES buildings(id) ON DELETE CASCADE,
  ports INTEGER,
  splitter VARCHAR,
  observations TEXT,
  created_by VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  sync_status VARCHAR DEFAULT 'synced',
  synced_at TIMESTAMP
);

-- Índices para performance
CREATE INDEX idx_buildings_sync_status ON buildings(sync_status);
CREATE INDEX idx_ctos_building_id ON ctos(building_id);
CREATE INDEX idx_ctos_sync_status ON ctos(sync_status);
```

### 4. Iniciar Desenvolvimento

```bash
npm run dev
```

A aplicação abrirá em `http://localhost:5173`

## 📦 Build para Produção

```bash
npm run build
npm run preview
```

## 🏗️ Estrutura do Projeto

```
src/
├── pages/              # Componentes de páginas
│   ├── LoginPage.jsx
│   ├── DashboardPage.jsx
│   ├── BuildingsPage.jsx
│   ├── CTOsPage.jsx
│   └── BuildingDetailPage.jsx
├── db/                 # Configuração Dexie
│   └── dexie.js
├── services/           # Serviços de API e sincronização
│   ├── supabase.js
│   └── sync.js
├── App.jsx             # Componente principal
├── App.css             # Estilos globais
├── index.css
└── main.jsx
public/
├── manifest.json       # Configuração PWA
└── sw.js              # Service Worker
```

## 💾 Banco de Dados Local

A aplicação usa **IndexedDB** via **Dexie** para armazenar dados localmente:

- **technicians**: Informações do técnico logado
- **buildings**: Prédios cadastrados
- **ctos**: Caixas CTO cadastradas
- **syncQueue**: Fila de sincronização

## 🔄 Sincronização

A sincronização ocorre:

1. **Automaticamente** quando a conexão é restaurada
2. **A cada 30 segundos** quando online (configurável)
3. **Sob demanda** pelo botão "Sincronizar Agora"

## 📱 Instalar como PWA

### Chrome/Edge (Android/Desktop)
1. Abra a aplicação
2. Clique no menu (⋮)
3. Selecione "Instalar aplicativo"

### Safari (iOS)
1. Clique em Compartilhar
2. Selecione "Adicionar à Tela de Início"

## 🎯 Funcionalidades

### Dashboard
- Visão geral de prédios e caixas
- Status de conexão (Online/Offline)
- Botão de sincronização manual
- Informações do técnico logado

### Cadastro de Prédios
- ➕ Criar novo prédio
- ✏️ Editar prédio
- 🗑️ Deletar prédio
- 🔍 Buscar por nome ou endereço

### Cadastro de Caixas CTO
- ➕ Criar nova caixa
- ✏️ Editar caixa
- 🗑️ Deletar caixa
- 🔍 Buscar por código
- 📍 Filtrar por prédio

## ⚙️ Tecnologias

- **React 18** - UI Framework
- **Vite** - Build tool
- **React Router** - Roteamento
- **Dexie** - IndexedDB wrapper
- **Supabase** - Backend e banco de dados
- **CSS3** - Estilos responsivos

## 📝 Notas Importantes

- Os dados são salvos **localmente** primeiro
- A sincronização ocorre automaticamente quando conectado
- Sem autenticação complexa - apenas nome e matrícula
- Otimizado para baixa largura de banda
- Interface leve e rápida para conexões lentas

## 🐛 Troubleshooting

### Service Worker não está registrando?
Verifique se está usando HTTPS em produção (PWA requer)

### Dados não sincronizam?
1. Verifique credenciais do Supabase em `.env.local`
2. Confirme que as tabelas foram criadas
3. Verifique a conexão de internet
4. Veja o console do navegador para erros

### IndexedDB vazio?
Execute a aplicação com o console aberto para verificar erros de inicialização

## 📄 Licença

MIT

## 👨‍💻 Desenvolvido para

Sistema de gerenciamento de campo para técnicos de telecom
