# DeliveryHub — Wireframes Low-Fi (MVP)

> Versão: 0.1
> Formato: ASCII text para iteração rápida; viram telas em shadcn/ui na implementação.
> 7 telas-chave do MVP. Textos em PT-BR (como aparecem ao usuário).

---

## Layout base (após login)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ DeliveryHub        Loja: Burger do João ▾    🟢 Aberta    🔔 3   Foto ▾    │ ← Topbar
├──────────┬──────────────────────────────────────────────────────────────────┤
│          │                                                                  │
│ 📋 Hub   │                                                                  │
│ 🍔 Cardá │                  CONTEÚDO DA PÁGINA                              │
│ 💰 Preço │                                                                  │
│ ⏸️ Pausa │                                                                  │
│ 💳 Finan │                                                                  │
│ ⚙️ Confi │                                                                  │
│          │                                                                  │
│ 👤 João  │                                                                  │
│ Sair     │                                                                  │
└──────────┴──────────────────────────────────────────────────────────────────┘
```

- **Topbar:** seletor de loja (só aparece se >1 loja na org), badge de status global da loja, sininho de notificações, menu do usuário.
- **Sidebar:** 6 itens de navegação no MVP. Colapsável em telas < 1024px.
- **Cores de status:** 🟢 aberta · 🟡 pausada · 🔴 erro de integração.
- **Mobile (< 768px):** sidebar vira drawer; topbar fica fixa.

---

## Tela 1 — Login + Onboarding

### 1.1. Login

```
                         ┌──────────────────────────┐
                         │      DeliveryHub         │
                         │                          │
                         │  Entre na sua conta      │
                         │                          │
                         │  E-mail                  │
                         │  ┌────────────────────┐  │
                         │  │                    │  │
                         │  └────────────────────┘  │
                         │                          │
                         │  Senha                   │
                         │  ┌────────────────────┐  │
                         │  │              👁️    │  │
                         │  └────────────────────┘  │
                         │                          │
                         │  [    Entrar    ]        │
                         │                          │
                         │  Esqueci minha senha     │
                         │  ──────────────────      │
                         │  Criar conta             │
                         └──────────────────────────┘
```

### 1.2. Onboarding — 3 passos após criar conta

```
 ●─────●─────○─────○      Passo 2 de 4
 OK    OK    Loja  iFood

 ┌──────────────────────────────────────────────────────────┐
 │  Crie sua primeira loja                                  │
 │                                                          │
 │  Nome da loja      ┌──────────────────────────────────┐  │
 │                    │ Burger do João                   │  │
 │                    └──────────────────────────────────┘  │
 │                                                          │
 │  CEP               ┌──────────────────┐  [ Buscar ]      │
 │                    │ 01310-100        │                  │
 │                    └──────────────────┘                  │
 │                                                          │
 │  Endereço completo (preenchido automaticamente)          │
 │                                                          │
 │  Fuso horário      [ America/Sao_Paulo (UTC−3) ▾ ]       │
 │                                                          │
 │              [ Voltar ]      [ Continuar → ]             │
 └──────────────────────────────────────────────────────────┘
```

**Passos do onboarding:**
1. Criar conta (e-mail + senha)
2. Dados da organização (CNPJ opcional no MVP, regime tributário)
3. Primeira loja
4. Conectar iFood (próxima tela)

---

## Tela 2 — Conectar iFood

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Integrações                                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────┐    ┌─────────────────────────┐                 │
│  │ 🟥  iFood               │    │ 🟧  Rappi               │                 │
│  │                         │    │                         │                 │
│  │ Não conectado           │    │ Em breve                │                 │
│  │                         │    │                         │                 │
│  │  [ Conectar iFood ]     │    │  (desabilitado)         │                 │
│  └─────────────────────────┘    └─────────────────────────┘                 │
│                                                                             │
│  ┌─────────────────────────┐    ┌─────────────────────────┐                 │
│  │ 🟩  99Food              │    │ 🟦  Keeta               │                 │
│  │ Em breve                │    │ Em breve                │                 │
│  └─────────────────────────┘    └─────────────────────────┘                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Ao clicar "Conectar iFood" → modal/wizard:**

```
 ┌──────────────────────────────────────────────────────────────┐
 │  Conectar iFood — Passo 1 de 3                          ✕    │
 │                                                              │
 │  Você precisa autorizar o DeliveryHub a acessar a sua loja   │
 │  iFood. Vamos abrir o portal do iFood em uma nova aba.       │
 │                                                              │
 │  ✓ Lemos seus pedidos em tempo real                          │
 │  ✓ Sincronizamos cardápio e preços                           │
 │  ✓ Pausamos/reabrimos sua loja a seu pedido                  │
 │                                                              │
 │  ⓘ Nunca acessamos dados de outras lojas ou alteramos        │
 │     nada sem sua confirmação.                                │
 │                                                              │
 │                          [ Autorizar no iFood → ]            │
 └──────────────────────────────────────────────────────────────┘
```

**Após callback OAuth:**
- Passo 2: sincronização inicial do cardápio (progress bar). Mostra "Importando 47 itens..."
- Passo 3: confirmação de taxas. Form pré-preenchido com `commission_pct`, `payment_processing_pct` da `platform_fee_profile`. Usuário valida ou edita.

---

## Tela 3 — Hub de Pedidos ⭐ (tela mais usada)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Pedidos                                                            [Som 🔊]│
├─────────────────────────────────────────────────────────────────────────────┤
│ Filtros: [Tudo ▾] [iFood] [Rappi]  |  Status: [Todos ▾]  |  🔍 Buscar       │
├──────────────┬──────────────┬──────────────┬──────────────────────────────┤
│  NOVOS (3)   │ EM PREPARO 5 │  PRONTOS 2   │  DESPACHADOS 4               │
├──────────────┼──────────────┼──────────────┼──────────────────────────────┤
│ ╔══════════╗ │ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐                 │
│ ║🟥 #2847  ║ │ │🟥 #2845  │ │ │🟥 #2843  │ │ │🟥 #2841  │ Maria S.        │
│ ║Maria S.  ║ │ │João P.   │ │ │Ana L.    │ │ │R$ 47,90  │                 │
│ ║R$ 89,50  ║ │ │R$ 67,20  │ │ │R$ 33,40  │ │ │há 32min  │                 │
│ ║Líq R$ 67 ║ │ │há 12min  │ │ │há 22min  │ │ └──────────┘                 │
│ ║há 2min ⏱║ │ │  ⚠ atrasa│ │ │ 🟡 fria? │ │                              │
│ ║          ║ │ └──────────┘ │ └──────────┘ │ ┌──────────┐                 │
│ ║[Recusar] ║ │              │              │ │🟥 #2838  │                 │
│ ║[Aceitar] ║ │ ┌──────────┐ │              │ └──────────┘                 │
│ ╚══════════╝ │ │🟥 #2844  │ │              │                              │
│              │ │...       │ │              │                              │
│ ┌──────────┐ │ └──────────┘ │              │                              │
│ │🟥 #2846  │ │              │              │                              │
│ │...       │ │              │              │                              │
│ └──────────┘ │              │              │                              │
└──────────────┴──────────────┴──────────────┴──────────────────────────────┘
```

**Comportamento:**
- 4 colunas (Kanban). Novo pedido **pisca + toca som** + entra na coluna "Novos".
- Card destacado (borda dupla) = novo aguardando ação.
- **Drag-and-drop** entre colunas avança status (também acionável em botão).
- Badge `🟥` = ícone iFood; cor por plataforma.
- `R$ XX` = bruto; `Líq R$ YY` = depois de taxas.
- `⏱` = tempo desde recebimento; alerta amarelo após X min sem ação.
- Click no card → drawer lateral com detalhe.

### Drawer de detalhe do pedido

```
                              ┌──────────────────────────────────┐
                              │ Pedido #2847 — 🟥 iFood    ✕     │
                              ├──────────────────────────────────┤
                              │ Maria Silva • (11) 9****-1234   │
                              │ Rua das Flores, 123 — Sala 4    │
                              │ ────────────────────────────────│
                              │ 1× Smash Burger Duplo  R$ 39,90 │
                              │   + Cheddar extra      R$  4,00 │
                              │   - Sem cebola                  │
                              │ 1× Batata G            R$ 18,00 │
                              │ 1× Coca-Cola 350ml     R$  8,00 │
                              │ ────────────────────────────────│
                              │ Subtotal               R$ 69,90 │
                              │ Entrega                R$  9,90 │
                              │ Taxa iFood (23%)      –R$ 16,07 │
                              │ Líquido para você      R$ 63,73 │
                              │ ────────────────────────────────│
                              │ Obs: "Por favor caprichar"      │
                              │ ────────────────────────────────│
                              │  [ Recusar ]   [ Aceitar → ]    │
                              └──────────────────────────────────┘
```

---

## Tela 4 — Cardápio com Preço Multi-plataforma

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Cardápio                              [+ Categoria]  [+ Item]  [Sincronizar↻]│
├─────────────────────────────────────────────────────────────────────────────┤
│ ▾ Hambúrgueres (12 itens)                                                   │
│ ▾ Bebidas (8 itens)                                                         │
│ ▸ Sobremesas (4 itens)                                                      │
│ ▸ Combos (3 itens)                                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  ITEM             CMV    │  🟥 iFood          │  🟧 Rappi (não conectado)   │
│                          │ Preço   Margem     │                             │
├──────────────────────────┼────────────────────┼─────────────────────────────┤
│ ☐ Smash Duplo     12,00  │ 39,90   ✅ 38% ⓘ   │ —                          │
│ ☐ Cheeseburger    8,50   │ 28,90   ✅ 41%     │ —                          │
│ ☐ Bacon Burger    11,00  │ 36,90   ⚠️ 22%     │ —                          │
│ ☐ Veggie Burger   9,00   │ 32,90   ✅ 35%     │ —                          │
│ ☐ Coca 350        2,40   │  8,00   🟥 −5%     │ —                          │
│                                                                             │
│  [Ações em lote ▾]   ←   selecionar itens para aplicar batch                │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Por linha:**
- Checkbox para batch.
- CMV (custo) sempre visível.
- Por plataforma: **preço de venda** + **margem líquida** com cor (✅ verde > meta, ⚠️ amarelo abaixo, 🟥 vermelho negativo).
- Tooltip `ⓘ` na margem mostra breakdown: preço − comissão − processamento − CMV.

**Clique no item → modal/página de edição:**

```
 ┌──────────────────────────────────────────────────────────────────────────┐
 │  Smash Duplo                                                       ✕     │
 │  ───────────────────────────────────────────────────────────────────────  │
 │  Nome         ┌────────────────────────────┐                              │
 │               │ Smash Duplo                │                              │
 │  Categoria    [ Hambúrgueres ▾ ]                                          │
 │  Descrição    ┌────────────────────────────────────────────────────────┐ │
 │               │ Dois smash 90g, queijo, alface, tomate, molho.         │ │
 │               └────────────────────────────────────────────────────────┘ │
 │  Foto         [ Upload ]                                                  │
 │  Tempo prep   ┌─────┐ min                                                 │
 │               │  12 │                                                     │
 │               └─────┘                                                     │
 │  Alergênicos  [glúten ✕] [lactose ✕] [+ adicionar]                        │
 │                                                                           │
 │  ═══════════ Preços por plataforma ═══════════                            │
 │  CMV (custo)  ┌────────┐                                                  │
 │               │ R$ 12,00│                                                 │
 │               └────────┘                                                  │
 │                                                                           │
 │  Plataforma │ Preço     │ Disponível │ Publicado │ Margem líq             │
 │  ───────────┼───────────┼────────────┼───────────┼──────────              │
 │  🟥 iFood   │ R$ 39,90  │   [ ✓ ]    │   [ ✓ ]   │  38% ✅                │
 │                                                                           │
 │  ═══════════ Adicionais (3 grupos) ═══════════                            │
 │  ▸ Ponto da carne (obrigatório, escolha 1)                                │
 │  ▸ Extras (até 5)                                                         │
 │  ▸ Trocar acompanhamento (opcional)                                       │
 │                                                                           │
 │                  [ Cancelar ]    [ Salvar e sincronizar → ]               │
 └──────────────────────────────────────────────────────────────────────────┘
```

---

## Tela 5 — Simulador de Margem (batch de preço) ⭐

Acessada via "Ações em lote → Alterar preço" na tela de cardápio.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Alterar preço em lote                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Itens selecionados: 12 (de Hambúrgueres)                                   │
│                                                                             │
│  Estratégia:                                                                │
│  ( ) Mesmo preço bruto em todas as plataformas                              │
│  ( ) Delta fixo em reais (ex.: +R$ 2,00)                                    │
│  (●) Manter mesma margem líquida em todas as plataformas  ⭐                │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │  Quero que cada item tenha margem líquida de…                   │       │
│  │  [ 35 ]%                                                        │       │
│  │                                                                  │       │
│  │  Limite mínimo: 25% — abaixo disso, marca em vermelho            │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                             │
│  ─────────────────────  Pré-visualização  ─────────────────────             │
│                                                                             │
│  Item            CMV    │  🟥 iFood (23%)               │ ...               │
│                         │ Atual → Novo    Margem        │                   │
│  ───────────────────────┼───────────────────────────────┼──────             │
│  Smash Duplo    12,00   │ 39,90 → 41,30   38% → 35%     │                   │
│  Cheeseburger    8,50   │ 28,90 → 29,15   41% → 35%     │                   │
│  Bacon Burger   11,00   │ 36,90 → 37,85   22% → 35% ⬆️  │                   │
│  Veggie Burger   9,00   │ 32,90 → 30,98   35% → 35%     │                   │
│  ...                                                                        │
│                                                                             │
│  ⓘ Quando conectar Rappi/99Food, este simulador calculará automaticamente   │
│     preços distintos por plataforma para manter a mesma margem.             │
│                                                                             │
│              [ Cancelar ]    [ Aplicar em 12 itens → ]                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Comportamento:**
- Recalcula em tempo real ao mexer no slider/input.
- Validação: avisa se algum item ficaria com margem < limite mínimo, oferece "manter atual" para esses.
- Aplicação: cria audit_log, dispara jobs `ifood:menu-push`, mostra toast com link para "Sincronizando 12 itens...".

---

## Tela 6 — Pausa Multiplataforma ⭐

Acessada do header (botão "🟢 Aberta") ou da sidebar.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Status da loja                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Status atual: 🟢 Aberta em todas as plataformas conectadas (1)            │
│                                                                             │
│  ═══════════════════════ Pausar agora ═══════════════════════               │
│                                                                             │
│  Escopo:                                                                    │
│  (●) Loja inteira                                                           │
│  ( ) Categoria específica                                                   │
│  ( ) Item específico                                                        │
│                                                                             │
│  Plataformas:                                                               │
│  [ ✓ ] 🟥 iFood    (conectada)                                              │
│  [ – ] 🟧 Rappi    (não conectada)                                          │
│                                                                             │
│  Por quanto tempo:                                                          │
│  ( ) 30 minutos                                                             │
│  (●) 1 hora                                                                 │
│  ( ) Até manualmente reabrir                                                │
│  ( ) Personalizado: até [ 18:00 ] hoje                                      │
│                                                                             │
│  Motivo (opcional, para analytics):                                         │
│  [ Cozinha sobrecarregada ▾ ]                                               │
│                                                                             │
│                              [ Pausar → ]                                   │
│                                                                             │
│  ═══════════════════ Agendamentos recorrentes ═══════════════════           │
│                                                                             │
│  ⏰ Pausar todos os dias das 15:00 às 17:00     [ Editar ]  [ Excluir ]    │
│  ⏰ Pausar segundas das 22:00 às 00:00         [ Editar ]  [ Excluir ]    │
│                                                                             │
│  [ + Nova regra programada ]                                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Estado "pausada":**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Status atual: 🟡 Loja pausada em iFood até 15:00 (em 47 min)               │
│  Motivo: Cozinha sobrecarregada · Aplicada por João às 14:13                │
│                                                                             │
│              [ Reabrir agora ]   [ Estender por +30min ]                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Estado com erro de propagação:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Status atual: 🔴 Erro em iFood — não foi possível pausar                   │
│  Última tentativa: há 12s · Próxima tentativa: em 18s (3/5)                 │
│                                                                             │
│  [ Tentar agora ]   [ Detalhes do erro ]   [ Reportar problema ]            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Tela 7 — Financeiro e Conciliação

### 7.1. Dashboard

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Financeiro                                Período: [ Últimos 30 dias ▾ ]   │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐│
│  │ Faturamento    │ │ Taxas pagas    │ │ Líquido        │ │ Ticket médio   ││
│  │ R$ 47.230,10   │ │ R$ 10.871,00   │ │ R$ 36.359,10   │ │ R$ 67,42       ││
│  │ ▲ 12% vs mês.  │ │ 23% médio      │ │ ▲ 10% vs mês.  │ │ ▲ R$ 2,30      ││
│  └────────────────┘ └────────────────┘ └────────────────┘ └────────────────┘│
│                                                                             │
│  ═══════════════════ Faturamento por dia ═══════════════════                │
│  R$                                                                         │
│  2.5k │                                  ▆                                  │
│  2.0k │     ▆           ▆       ▆        █     ▆                            │
│  1.5k │ ▅   █   ▃   ▅   █   ▅   █   ▅    █  ▅  █   ▅                        │
│  1.0k │ █   █   █   █   █   █   █   █    █  █  █   █                        │
│       └─────────────────────────────────────────────                        │
│        S  M  T  W  T  F  S  M  T  W  T  F  S  M  T                          │
│                                                                             │
│  ═══════════════════ Por plataforma ═══════════════════                     │
│  🟥 iFood          R$ 47.230,10 (100%)    [Detalhar →]                     │
│                                                                             │
│  ═══════════════════ Top 5 itens (por margem) ═══════════════════           │
│  1. Smash Duplo        180 vendas    Margem total R$ 4.234                  │
│  2. Cheeseburger       142 vendas    Margem total R$ 3.420                  │
│  3. ...                                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2. Conciliação de repasses

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Conciliação                                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  [ + Importar extrato bancário (CSV) ]                                      │
│                                                                             │
│  ═══════════════════ Repasses pendentes (3) ═══════════════════             │
│                                                                             │
│  Plataforma │ Período          │ Esperado    │ Recebido   │ Status          │
│  ───────────┼──────────────────┼─────────────┼────────────┼─────────────    │
│  🟥 iFood   │ 01-07 mai/2026   │ R$ 7.823,40 │ R$ 7.823,40│ ✅ Conciliado  │
│  🟥 iFood   │ 08-14 mai/2026   │ R$ 8.114,90 │ R$ 8.014,90│ ⚠️ R$ 100 a-   │
│             │                  │             │            │   menos        │
│  🟥 iFood   │ 15-21 mai/2026   │ R$ 8.992,15 │ —          │ ⏳ Aguardando  │
│                                                                             │
│  ───────────────────────────────────────────────────────                    │
│  ⚠️ Há 1 divergência — clique para investigar                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Drill-in na linha com divergência:**

```
 ┌──────────────────────────────────────────────────────────────────────────┐
 │  Divergência — iFood 08-14 mai/2026                              ✕       │
 │                                                                          │
 │  Esperado pelo DeliveryHub:       R$ 8.114,90                            │
 │  Recebido no banco:               R$ 8.014,90                            │
 │  Diferença:                       R$    100,00  a menos                  │
 │                                                                          │
 │  ════════ Possíveis causas detectadas ════════                           │
 │  • 2 pedidos com chargeback no período (R$ 67,40 + R$ 32,60 = R$ 100,00) │
 │     → #2731, #2734                                                       │
 │                                                                          │
 │  [ Marcar como esclarecida ]   [ Adicionar nota ]   [ Exportar PDF ]    │
 └──────────────────────────────────────────────────────────────────────────┘
```

---

## Notas de UX transversais

| Aspecto | Decisão MVP |
|---|---|
| Tipografia | Inter (sistema), tamanhos generosos no Hub e em telas operacionais |
| Densidade | Hub: alta (cards compactos). Telas admin: média (espaços maiores) |
| Toque | Botões mín. 44×44px; áreas críticas (Aceitar/Pausar) 56×56px |
| Cores de status | 🟢 #16a34a · 🟡 #ca8a04 · 🔴 #dc2626 |
| Cores por plataforma | iFood `#EA1D2C` · Rappi `#FF441F` · 99Food `#FE3324` · Keeta `#FFCC00` |
| Modo escuro | Sim. Variáveis CSS via shadcn theme. |
| Loading | Skeleton em listas; spinner inline em ações pontuais |
| Empty states | Sempre com CTA claro ("Conecte sua primeira plataforma →") |
| Erros | ProblemDetails (RFC 7807) → toast amigável + link "ver detalhes" |
| Som no Hub | Bell quando novo pedido; configurável on/off; tocável também via tab oculta (Service Worker) |
| Confirmação destrutiva | Modal com typed-confirm em ações irreversíveis (delete loja, alteração de preço em > 50 itens) |

---

## Telas fora do MVP (mas reservadas no menu)

```
🛒 Estoque         (fase 2)
👥 Clientes        (fase 2)
🎯 Promoções       (fase 2)
⭐ Avaliações      (fase 2)
📊 Relatórios BI   (fase 2)
🏬 Lojas (rede)    (fase 2)
```

Esses links aparecem no menu **desabilitados com tooltip "Em breve"** desde o MVP — sinaliza ao usuário a direção do produto.
