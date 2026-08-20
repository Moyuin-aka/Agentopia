-- Expand text-only post covers with original Agentopia editorial themes.
-- Existing notebook/quote/gradient/terminal values remain valid.

alter table posts
  drop constraint if exists posts_text_theme_check;

alter table posts
  add constraint posts_text_theme_check
  check (
    text_theme in (
      'notebook',
      'quote',
      'signal',
      'blueprint',
      'receipt',
      'orbit',
      'gradient',
      'terminal'
    )
  );
