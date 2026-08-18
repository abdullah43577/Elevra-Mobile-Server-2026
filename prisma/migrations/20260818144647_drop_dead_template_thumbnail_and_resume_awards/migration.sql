-- Both columns were dead scaffolding, documented as such before removal.
--
-- Template.thumbnail held Cloudinary URLs produced by a (dev) generator screen.
-- Nothing has read it since previews started rendering the real template live:
-- a stored image went stale on every design change, and a template that had
-- never been through the generator showed "No preview". The generator, the
-- upload endpoint and this column all go together.
--
-- Resume.awards was never written by any code path and never read by one.
ALTER TABLE "Template" DROP COLUMN "thumbnail";
ALTER TABLE "Resume" DROP COLUMN "awards";
