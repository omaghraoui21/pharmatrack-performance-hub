-- Ajouter colonne attachment_url pour les pièces jointes photos aux événements
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- Créer le bucket pour les pièces jointes des événements
INSERT INTO storage.buckets (id, name, public) 
VALUES ('event-attachments', 'event-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Politique: tout le monde peut voir les pièces jointes
CREATE POLICY "Event attachments are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'event-attachments');

-- Politique: les utilisateurs authentifiés peuvent uploader
CREATE POLICY "Authenticated users can upload event attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'event-attachments' AND auth.role() = 'authenticated');

-- Politique: les utilisateurs peuvent supprimer leurs propres uploads
CREATE POLICY "Users can delete their own event attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'event-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);