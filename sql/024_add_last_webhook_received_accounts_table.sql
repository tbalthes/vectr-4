-- Add last_webhook_received_at to account_links, with proper relationships

ALTER TABLE public.account_links
ADD COLUMN last_webhook_received_at timestamptz;

-- Add last_webhook_received_at to account_links, with proper relationships

ALTER TABLE public.account_links
ADD COLUMN last_webhook_received_at timestamptz;

-- Add a nullable reference to the last webhook event (optional, for traceability)
ALTER TABLE public.account_links
ADD COLUMN last_webhook_event_id uuid;

ALTER TABLE public.account_links
ADD CONSTRAINT fk_last_webhook_event
FOREIGN KEY (last_webhook_event_id)
REFERENCES public.webhook_events(id)
ON DELETE SET NULL;

ALTER TABLE public.account_links
ADD CONSTRAINT unique_item_id UNIQUE (item_id);

CREATE INDEX IF NOT EXISTS idx_account_links_item_id ON public.account_links(item_id);
CREATE INDEX IF NOT EXISTS idx_account_links_last_webhook_received_at ON public.account_links(last_webhook_received_at);