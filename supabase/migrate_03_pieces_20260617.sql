-- ============================================================
-- FLIPWORK-MIGRATE-03  —  PIECES (15)  —  2026-06-17
-- ============================================================
-- Moves the 15 furniture pieces from the OLD books project into the
-- marketplace app's inventory_pieces table.
--
-- Mapping:  name->title, description->notes (blank if empty),
--           acquired_date->acquired_at, sold_date->sold_at,
--           image_path + original id kept, created_at preserved,
--           owner stamped = corythacker@gmail.com (72f3...d2a9).
-- Stage from old status:  'sold' -> 'sold' ,  'for_sale' -> 'listed'.
--
-- Run in the MARKETPLACE project ("FlipWork Web App"), Primary db.
-- Safe to re-run: ON CONFLICT (id) DO NOTHING keeps it from duplicating.
-- ============================================================

insert into public.inventory_pieces
  (id, owner_user_id, title, stage, notes, image_path, acquired_at, sold_at, created_at)
values
  ('9bb296dd-8ee3-43c8-92ca-e15f0a2d8161','72f34512-113f-4c02-b638-0ddf3236d2a9','Cherry Chest of Drawers','sold','','piece-9bb296dd-8ee3-43c8-92ca-e15f0a2d8161.jpg',null,null,'2026-06-11T22:11:26.166862+00:00'),
  ('c201ac7c-99f4-4f73-85bc-ed25ed272549','72f34512-113f-4c02-b638-0ddf3236d2a9','Oatmeal Modern Chest of Drawers','sold','','piece-c201ac7c-99f4-4f73-85bc-ed25ed272549.jpg',null,null,'2026-06-11T22:12:55.0271+00:00'),
  ('4a4eaf4e-7276-4526-baa9-b788eed89205','72f34512-113f-4c02-b638-0ddf3236d2a9','Gray Chest of Drawers','sold','','piece-4a4eaf4e-7276-4526-baa9-b788eed89205.jpg',null,null,'2026-06-11T22:15:46.793886+00:00'),
  ('083f8ce7-2b9c-4a20-9929-b588b5107093','72f34512-113f-4c02-b638-0ddf3236d2a9','2’ x 6’ x 3’ Cedar Raised Garden bed','sold','','piece-083f8ce7-2b9c-4a20-9929-b588b5107093.jpg',null,null,'2026-06-11T22:55:25.533389+00:00'),
  ('62360f42-24cc-4465-9750-ea3df0be7fe2','72f34512-113f-4c02-b638-0ddf3236d2a9','Black Nightstands w Drawers','sold','','piece-62360f42-24cc-4465-9750-ea3df0be7fe2/d36ff395-1288-46f7-a0be-d06b47d0e6f7.jpg',null,null,'2026-06-12T01:26:39.922281+00:00'),
  ('65c5133d-95ef-45e0-b1f8-127e48676ee4','72f34512-113f-4c02-b638-0ddf3236d2a9','MCM Black Dresser/Chest of drawers set','sold','','piece-65c5133d-95ef-45e0-b1f8-127e48676ee4/d35d8486-cb0b-40e3-8be1-de250f330dc4.jpg','2026-03-18',null,'2026-06-11T19:52:00.48071+00:00'),
  ('11e09352-594b-484e-a1e9-23caa70f9dba','72f34512-113f-4c02-b638-0ddf3236d2a9','Small dresser 3 drawers','listed','','piece-11e09352-594b-484e-a1e9-23caa70f9dba/6d31ac79-adbe-4aee-83ad-a03e2a6be511.jpg','2026-06-09',null,'2026-06-11T19:56:25.172771+00:00'),
  ('d3569fb4-9644-4e01-af86-87f6c59d2d6d','72f34512-113f-4c02-b638-0ddf3236d2a9','Blue Chest of drawers','sold','','piece-d3569fb4-9644-4e01-af86-87f6c59d2d6d/89198ca4-6b20-4459-9d3b-01c780e6160a.jpg','2026-06-12',null,'2026-06-14T17:18:01.150115+00:00'),
  ('112cb08f-ae93-4487-92ee-0740dc00df53','72f34512-113f-4c02-b638-0ddf3236d2a9','Black Dresser 6-drawers','sold','','piece-112cb08f-ae93-4487-92ee-0740dc00df53/9ad60d16-89d5-4d61-a4a2-d87667196658.jpg','2026-06-09',null,'2026-06-11T19:54:36.52665+00:00'),
  ('b20251eb-568e-4797-9a31-a5f551b64f51','72f34512-113f-4c02-b638-0ddf3236d2a9','Teak Bench','sold','Teak Bench with white cushion','piece-b20251eb-568e-4797-9a31-a5f551b64f51/606634c5-fc70-40bd-bcc0-e4eac79f52f4.jpg',null,'2026-06-06','2026-06-11T00:48:32.970238+00:00'),
  ('d2b89194-a939-473e-8bd8-6381417725af','72f34512-113f-4c02-b638-0ddf3236d2a9','Off-white Credenza','sold','','piece-d2b89194-a939-473e-8bd8-6381417725af.jpg',null,null,'2026-06-11T00:04:13.345183+00:00'),
  ('003566b8-2292-4528-be88-3e2f2a7c8072','72f34512-113f-4c02-b638-0ddf3236d2a9','Dresser American Drew Black','sold','Black horizontal dresser with gold hardware and feet','piece-003566b8-2292-4528-be88-3e2f2a7c8072.jpg',null,'2026-06-06','2026-06-11T00:03:12.318982+00:00'),
  ('fff9bae7-a019-4fce-8a69-f8d06865eb80','72f34512-113f-4c02-b638-0ddf3236d2a9','Dresser 5-drawer Lemongrass Yellow','sold','Yellow Dresser with 5 drawers and silver hardware','piece-fff9bae7-a019-4fce-8a69-f8d06865eb80/b6f5b7d9-cf36-4772-bb67-a8cc59a3989a.jpg','2026-06-03','2026-06-10','2026-06-04T22:18:26.969349+00:00'),
  ('56dc8ca4-bed7-45eb-a13b-76d26430f6bc','72f34512-113f-4c02-b638-0ddf3236d2a9','Chest of drawers Silhouette','listed','','piece-56dc8ca4-bed7-45eb-a13b-76d26430f6bc/839d8426-d7c6-48ac-b00c-d9cd129da24b.jpg','2026-06-03',null,'2026-06-05T03:41:59.031397+00:00'),
  ('88a12875-43d1-4c52-ad69-ffd389f808ed','72f34512-113f-4c02-b638-0ddf3236d2a9','Chest of drawers blue','listed','Blue chest of drawers with silver handles','piece-88a12875-43d1-4c52-ad69-ffd389f808ed/38733086-63ec-47ae-ac85-d2dbdc5c33c7.jpg','2026-06-03',null,'2026-06-05T03:38:05.24061+00:00')
on conflict (id) do nothing;

-- verify: should return 15
select count(*) as imported_pieces
from public.inventory_pieces
where id in (
  '9bb296dd-8ee3-43c8-92ca-e15f0a2d8161','c201ac7c-99f4-4f73-85bc-ed25ed272549',
  '4a4eaf4e-7276-4526-baa9-b788eed89205','083f8ce7-2b9c-4a20-9929-b588b5107093',
  '62360f42-24cc-4465-9750-ea3df0be7fe2','65c5133d-95ef-45e0-b1f8-127e48676ee4',
  '11e09352-594b-484e-a1e9-23caa70f9dba','d3569fb4-9644-4e01-af86-87f6c59d2d6d',
  '112cb08f-ae93-4487-92ee-0740dc00df53','b20251eb-568e-4797-9a31-a5f551b64f51',
  'd2b89194-a939-473e-8bd8-6381417725af','003566b8-2292-4528-be88-3e2f2a7c8072',
  'fff9bae7-a019-4fce-8a69-f8d06865eb80','56dc8ca4-bed7-45eb-a13b-76d26430f6bc',
  '88a12875-43d1-4c52-ad69-ffd389f808ed'
);

-- ============================================================
-- End FLIPWORK-MIGRATE-03
-- ============================================================
