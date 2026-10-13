# Kirche Connect — preparação (não implementado)

Produto futuro de descoberta/comunidade. **Nenhum dado privado do Kirche Core migra para o Connect por padrão.**
A igreja aprova explicitamente o que publicar.

## Contratos previstos (para migration futura)

```ts
// Perfil público verificado de uma igreja
interface PublicChurchProfile {
  organizationId: string;
  slug: string;
  displayName: string;
  denomination: string | null;
  city: string; state: string;          // localização pública aprovada
  serviceTimes: { weekday: number; time: string; label: string }[];
  liveStreamUrl: string | null;
  verifiedAt: string | null;            // verificação de identidade oficial
  publishedAt: string; updatedAt: string;
}

// Evento marcado como público pela igreja
interface PublicEvent {
  id: string; organizationId: string; sourceEventId: string;  // referência a events.id
  title: string; startsAt: string; publicLocation: string;
  publishedBy: string; publishedAt: string;
}

// Consentimento de publicação por item/campo
interface IntegrationConsent {
  organizationId: string; scope: 'profile' | 'event' | 'live';
  grantedBy: string; grantedAt: string; revokedAt: string | null;
}
```

Regras:
- Tabelas `public_church_profiles`, `public_events`, `integration_consents` com escrita apenas por `church.manage_settings`.
- Leitura pública por view dedicada (anon), nunca pelas tabelas internas.
- Revogação remove a publicação imediatamente.
- Fora desta fase: rede social, chat aberto, seguidores, enciclopédia colaborativa, moderação.
