-- ============================================================
-- FLIPWORK — books_inventory_items table  —  2026-06-17
-- ============================================================
-- Your supplies/hardware stock (knobs, pulls, legs, slides...).
-- books_ prefix so it can't collide with any stray inventory_items table.
-- Per-owner: you only see your own stock.
-- Run in the MARKETPLACE project ("FlipWork Web App"), Primary db.
-- ============================================================

create table if not exists public.books_inventory_items (
  id            uuid primary key default uuid_generate_v4(),
  owner_user_id uuid references public.users(id) on delete cascade not null,
  name          text not null default '',
  unit          text,
  avg_cost      numeric not null default 0,   -- kept full precision (averages)
  quantity      numeric not null default 0,
  image_path    text,
  reorder_level numeric,
  created_at    timestamptz not null default now()
);

create index if not exists books_inventory_items_owner_idx
  on public.books_inventory_items (owner_user_id);

alter table public.books_inventory_items enable row level security;

drop policy if exists "owner manages own inventory items" on public.books_inventory_items;
create policy "owner manages own inventory items"
  on public.books_inventory_items for all
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

-- ============================================================
-- End books_inventory_items
-- ============================================================


-- ---- DATA: 68 supply items, owner-stamped, original ids kept ----
insert into public.books_inventory_items
  (id, owner_user_id, name, unit, avg_cost, quantity, image_path, reorder_level, created_at)
values
('c565232e-70c4-4d7b-b65a-5255d970e0ff','72f34512-113f-4c02-b638-0ddf3236d2a9','3” Top-mount Pull Black','Each','0.1','10','inventory-c565232e-70c4-4d7b-b65a-5255d970e0ff.jpg',NULL,'2026-06-11 16:40:48.482615+00'),
('b51e13d9-5b3c-4074-bd95-a9b411fe858e','72f34512-113f-4c02-b638-0ddf3236d2a9','Circle Knob Oil Rubbed Bronze','Each','1.1340000000000001','25','inventory-b51e13d9-5b3c-4074-bd95-a9b411fe858e.jpg',NULL,'2026-06-11 16:45:02.785867+00'),
('744230c9-29b9-4eef-a756-01df3e2bbf8f','72f34512-113f-4c02-b638-0ddf3236d2a9','3" Gold Modern Pulls','each','1.502857142857143','6','inventory-744230c9-29b9-4eef-a756-01df3e2bbf8f.jpg',NULL,'2026-06-11 03:00:25.818731+00'),
('a314f544-1264-42ce-929c-6db87f69ea3a','72f34512-113f-4c02-b638-0ddf3236d2a9','Marble Gold Knob','Each','2','31','inventory-a314f544-1264-42ce-929c-6db87f69ea3a.jpg',NULL,'2026-06-11 14:10:46.27277+00'),
('307ded7a-0162-4caf-8a0a-a286467aa6d7','72f34512-113f-4c02-b638-0ddf3236d2a9','Black T-shaped Knob','Each','1.12','10','inventory-307ded7a-0162-4caf-8a0a-a286467aa6d7.jpg',NULL,'2026-06-11 14:15:11.505131+00'),
('e01d3c35-3d78-436d-a047-582bb2a2f487','72f34512-113f-4c02-b638-0ddf3236d2a9','3” Shiny Silver Arch Pulls','Each','0.2','5','inventory-e01d3c35-3d78-436d-a047-582bb2a2f487.jpg',NULL,'2026-06-12 02:21:29.454826+00'),
('fa0448eb-f3ac-49a1-a673-95c64287428a','72f34512-113f-4c02-b638-0ddf3236d2a9','Ceramic Knob Flower Vine','Each','0.16666666666666666','6','inventory-fa0448eb-f3ac-49a1-a673-95c64287428a.jpg',NULL,'2026-06-12 02:25:37.205105+00'),
('c1bd17e4-888a-4b37-93db-0020178aeb92','72f34512-113f-4c02-b638-0ddf3236d2a9','1” Beveled Circle Black Knobs','Each','0.045454545454545456','18','inventory-c1bd17e4-888a-4b37-93db-0020178aeb92.jpg',NULL,'2026-06-11 17:16:07.109696+00'),
('720aea88-8ced-49b6-95f3-401b14711d81','72f34512-113f-4c02-b638-0ddf3236d2a9','2.5” Black Modern Pull','Each','1','2','inventory-720aea88-8ced-49b6-95f3-401b14711d81.jpg',NULL,'2026-06-11 17:07:34.046516+00'),
('8a2e00b3-11d9-43a8-8ed6-970cc97a5bd0','72f34512-113f-4c02-b638-0ddf3236d2a9','Gold Convex Knob','Each','4','2','inventory-8a2e00b3-11d9-43a8-8ed6-970cc97a5bd0.jpg',NULL,'2026-06-11 14:14:20.104951+00'),
('9a20eb6a-9cc4-4d51-836b-1524ced8a046','72f34512-113f-4c02-b638-0ddf3236d2a9','1” Circle Black Knob','Each','0.5','6','inventory-9a20eb6a-9cc4-4d51-836b-1524ced8a046.jpg',NULL,'2026-06-11 17:13:43.986975+00'),
('5002681e-32ee-44ad-a6bf-ed564d3bf959','72f34512-113f-4c02-b638-0ddf3236d2a9','Gold 1” Circle Knob','Each','0.9065789473684212','39','inventory-5002681e-32ee-44ad-a6bf-ed564d3bf959.jpg',NULL,'2026-06-11 14:11:55.89474+00'),
('1c9ef9c0-db52-4839-905e-ed9022b416fc','72f34512-113f-4c02-b638-0ddf3236d2a9','Ceramic Knob Flower Shape','Each','0.16666666666666666','6','inventory-1c9ef9c0-db52-4839-905e-ed9022b416fc.jpg',NULL,'2026-06-12 02:27:54.766198+00'),
('3c17e496-ded7-49b2-af82-78ddeea164ce','72f34512-113f-4c02-b638-0ddf3236d2a9','4” Round Taper leg','Each','4.835','4','inventory-3c17e496-ded7-49b2-af82-78ddeea164ce.jpg',NULL,'2026-06-11 15:08:43.229471+00'),
('acfe381c-ecc7-45c8-a535-f716d6574df5','72f34512-113f-4c02-b638-0ddf3236d2a9','Hexagon Gold Knobs','Each','2','6','inventory-acfe381c-ecc7-45c8-a535-f716d6574df5.jpg',NULL,'2026-06-11 17:20:56.316097+00'),
('59290e9d-3ddc-42bf-a0f0-b6091430b6cc','72f34512-113f-4c02-b638-0ddf3236d2a9','3/4” Black Circle Knobs','Each','2','4','inventory-59290e9d-3ddc-42bf-a0f0-b6091430b6cc.jpg',NULL,'2026-06-11 17:24:32.76701+00'),
('2fe7fb17-e0c4-4f6a-a36e-00e87d25e735','72f34512-113f-4c02-b638-0ddf3236d2a9','Ceramic Knob Navigation','Each','0','0','inventory-2fe7fb17-e0c4-4f6a-a36e-00e87d25e735.jpg',NULL,'2026-06-11 15:48:32.027857+00'),
('462bfa91-6ec2-4949-9427-9574c28539ae','72f34512-113f-4c02-b638-0ddf3236d2a9','Ceramic Knob Flower Shape','Each','0.16666666666666666','6','inventory-462bfa91-6ec2-4949-9427-9574c28539ae.jpg',NULL,'2026-06-12 02:27:55.849782+00'),
('ab94c4ec-b41f-4299-ab96-aa197f7d839f','72f34512-113f-4c02-b638-0ddf3236d2a9','Ceramic Knob Floral','Each','0','0','inventory-ab94c4ec-b41f-4299-ab96-aa197f7d839f.jpg',NULL,'2026-06-11 15:50:19.730583+00'),
('276ab324-da17-45c6-9345-6d7fc68e4edc','72f34512-113f-4c02-b638-0ddf3236d2a9','Gold Oblong Knob','Each','0.1','10','inventory-276ab324-da17-45c6-9345-6d7fc68e4edc.jpg',NULL,'2026-06-11 17:29:01.597132+00'),
('89d9920d-7723-4966-a3cd-22f2a185db7b','72f34512-113f-4c02-b638-0ddf3236d2a9','5” Gold Modern Pulls','Each','0.05263157894736842','19','inventory-89d9920d-7723-4966-a3cd-22f2a185db7b.jpg',NULL,'2026-06-11 15:10:56.19445+00'),
('8578178e-f4af-4b88-a644-344da34b1b45','72f34512-113f-4c02-b638-0ddf3236d2a9','Ceramic Knob heart flowers','Each','0.16666666666666666','6','inventory-8578178e-f4af-4b88-a644-344da34b1b45.jpg',NULL,'2026-06-12 02:29:07.285135+00'),
('dce98db2-e12c-4aa7-88e4-5c4e4fe00cda','72f34512-113f-4c02-b638-0ddf3236d2a9','Ceramic Knob Bumpy Daisy','Each','0.16666666666666666','6','inventory-dce98db2-e12c-4aa7-88e4-5c4e4fe00cda.jpg',NULL,'2026-06-12 02:30:42.303898+00'),
('1065578a-d69d-4277-98c5-3849fed950c7','72f34512-113f-4c02-b638-0ddf3236d2a9','3” Copper Modern Pull','Each','1.04','40','inventory-1065578a-d69d-4277-98c5-3849fed950c7.jpg',NULL,'2026-06-11 14:09:42.944745+00'),
('e814da60-d783-486a-83e5-31f28d48ff88','72f34512-113f-4c02-b638-0ddf3236d2a9','3/4” Silver Circle Knobs','Each','0.14285714285714285','8','inventory-e814da60-d783-486a-83e5-31f28d48ff88.jpg',NULL,'2026-06-11 17:25:48.259665+00'),
('d057fe77-4ce6-4439-8030-6d86df04fa04','72f34512-113f-4c02-b638-0ddf3236d2a9','3” Silver Modern Pull','Each','1.3515625','37','inventory-d057fe77-4ce6-4439-8030-6d86df04fa04.jpg',NULL,'2026-06-11 14:08:39.243174+00'),
('9b2f0154-2392-4e37-aec7-9dbe2479d52a','72f34512-113f-4c02-b638-0ddf3236d2a9','Ceramic Knob flowers in a circle','Each','0.16666666666666666','6','inventory-9b2f0154-2392-4e37-aec7-9dbe2479d52a.jpg',NULL,'2026-06-12 02:32:06.520281+00'),
('f2331d36-32ff-4002-8ae8-45768b28c11e','72f34512-113f-4c02-b638-0ddf3236d2a9','Silver Drawer Pulls Curvy','Each','0.25','6','inventory-f2331d36-32ff-4002-8ae8-45768b28c11e.jpg',NULL,'2026-06-12 02:01:40.540227+00'),
('dd89c4a5-931e-4f52-902a-c8893fa2f520','72f34512-113f-4c02-b638-0ddf3236d2a9','Gold Slice Drawer Pull','Each','5.68','4','inventory-dd89c4a5-931e-4f52-902a-c8893fa2f520.jpg',NULL,'2026-06-12 02:06:36.98076+00'),
('dbaa44cd-7857-47b5-bc6e-94b72ed668bb','72f34512-113f-4c02-b638-0ddf3236d2a9','3.75” Gray Metal Drawer Pull','Each','0.25','4','inventory-dbaa44cd-7857-47b5-bc6e-94b72ed668bb.jpg',NULL,'2026-06-12 02:19:45.834495+00'),
('a382382f-e311-496f-a1ec-435fd3be318b','72f34512-113f-4c02-b638-0ddf3236d2a9','3.75” Gray Metal Drawer Pull','Each','0.25','4','inventory-a382382f-e311-496f-a1ec-435fd3be318b.jpg',NULL,'2026-06-12 02:19:47.106259+00'),
('3cb43ef1-3de8-499f-a991-fceb9b228ffe','72f34512-113f-4c02-b638-0ddf3236d2a9','Ceramic Knob Gerber Daisy','Each','0.16666666666666666','6','inventory-3cb43ef1-3de8-499f-a991-fceb9b228ffe.jpg',NULL,'2026-06-12 02:33:03.962707+00'),
('6b5e23cf-12b5-4118-8a52-9a3c3fcf85b3','72f34512-113f-4c02-b638-0ddf3236d2a9','Ceramic Knob Checker board','Each','0.16666666666666666','6','inventory-6b5e23cf-12b5-4118-8a52-9a3c3fcf85b3.jpg',NULL,'2026-06-12 02:34:05.456885+00'),
('aef679b5-4783-4e14-bed6-75160450d489','72f34512-113f-4c02-b638-0ddf3236d2a9','Ceramic Knob Blue Flower','Each','0.16666666666666666','6','inventory-aef679b5-4783-4e14-bed6-75160450d489.jpg',NULL,'2026-06-12 02:35:24.924678+00'),
('80def167-8985-43ac-91ac-76e7d9168c7a','72f34512-113f-4c02-b638-0ddf3236d2a9','White Metal Pulls','Each','0.25','4','inventory-80def167-8985-43ac-91ac-76e7d9168c7a.jpg',NULL,'2026-06-12 11:50:32.167629+00'),
('f0715360-2cd8-4691-8f01-4d41e92077d4','72f34512-113f-4c02-b638-0ddf3236d2a9','Gold Beveled Knob','Each','0.25','4','inventory-f0715360-2cd8-4691-8f01-4d41e92077d4.jpg',NULL,'2026-06-12 14:28:41.401914+00'),
('887f68cb-f0b6-4f33-a649-cebe3592e5dc','72f34512-113f-4c02-b638-0ddf3236d2a9','Circle Oil-rubbed Bronze Knob','Each','0.25','4','inventory-887f68cb-f0b6-4f33-a649-cebe3592e5dc.jpg',NULL,'2026-06-12 14:29:59.367586+00'),
('dfb546a7-b6cf-48f5-a045-a751884487d3','72f34512-113f-4c02-b638-0ddf3236d2a9','1.5” Diamond Knob','Each','0.1111111111111111','9','inventory-dfb546a7-b6cf-48f5-a045-a751884487d3.jpg',NULL,'2026-06-12 14:31:37.903303+00'),
('5d93d360-3059-4ab5-b24b-229dac1c73a9','72f34512-113f-4c02-b638-0ddf3236d2a9','3” Black Rectangle Pulls','Each','0.25','4','inventory-5d93d360-3059-4ab5-b24b-229dac1c73a9.jpg',NULL,'2026-06-12 14:32:59.951857+00'),
('6bedecbc-b2e1-4729-af91-90ddf0be1122','72f34512-113f-4c02-b638-0ddf3236d2a9','1” Brown Decorative Knob','Each','0.25','4','inventory-6bedecbc-b2e1-4729-af91-90ddf0be1122.jpg',NULL,'2026-06-12 14:34:10.675198+00'),
('d87fd853-d154-4ee2-8d1d-428abf89ea12','72f34512-113f-4c02-b638-0ddf3236d2a9','Circle Gold Knob w/ Rings','Each','0.25','4','inventory-d87fd853-d154-4ee2-8d1d-428abf89ea12.jpg',NULL,'2026-06-12 14:35:45.216387+00'),
('bb9422d1-2c55-4c9d-bfb8-0f1097ed620a','72f34512-113f-4c02-b638-0ddf3236d2a9','3” Oil-rubbed Bronze Pulls','Each','0.25','4','inventory-bb9422d1-2c55-4c9d-bfb8-0f1097ed620a.jpg',NULL,'2026-06-12 14:37:08.694489+00'),
('af6af02d-8b19-439d-8eeb-4ac47f777ad6','72f34512-113f-4c02-b638-0ddf3236d2a9','Circle Black Metal Knob','Each','0.2','5','inventory-af6af02d-8b19-439d-8eeb-4ac47f777ad6.jpg',NULL,'2026-06-12 14:38:27.851688+00'),
('1f066ac6-4d96-41dd-bcaf-fca3d08daced','72f34512-113f-4c02-b638-0ddf3236d2a9','Circle Black Metal Knob','Each','0.2','5','inventory-1f066ac6-4d96-41dd-bcaf-fca3d08daced.jpg',NULL,'2026-06-12 14:38:30.454569+00'),
('14f552af-b19a-4d6b-8639-cb16565a5d08','72f34512-113f-4c02-b638-0ddf3236d2a9','Circle Oil-rubbed Bronze Knob w/ decoration','Each','0.2','5','inventory-14f552af-b19a-4d6b-8639-cb16565a5d08.jpg',NULL,'2026-06-12 14:40:05.852548+00'),
('cc8a343a-0944-4007-b308-58268700eeb3','72f34512-113f-4c02-b638-0ddf3236d2a9','5” Black Metal Pulls','Each','0.5','2',NULL,NULL,'2026-06-12 14:41:17.080762+00'),
('bc455b84-bced-4ba1-b4ee-3bc364a5d245','72f34512-113f-4c02-b638-0ddf3236d2a9','5” Silver Modern Pulls','Each','0.5','2','inventory-bc455b84-bced-4ba1-b4ee-3bc364a5d245.jpg',NULL,'2026-06-12 14:42:51.481531+00'),
('73f1778d-3746-4205-a109-38ba97acdcf1','72f34512-113f-4c02-b638-0ddf3236d2a9','3” Black Modern Pull','Each','0.9675','1','inventory-73f1778d-3746-4205-a109-38ba97acdcf1.jpg',NULL,'2026-06-11 16:59:32.117576+00'),
('5d26cb6e-34eb-4f18-8388-d2eb03e00a3d','72f34512-113f-4c02-b638-0ddf3236d2a9','5” Silver Drawer Pull','Each','0.3333333333333333','3',NULL,NULL,'2026-06-12 14:44:20.635433+00'),
('d23e000a-8a30-4c2e-a409-ba1808788427','72f34512-113f-4c02-b638-0ddf3236d2a9','1/2” Gold “Spaceship” Knob','Each','0.16666666666666666','6','inventory-d23e000a-8a30-4c2e-a409-ba1808788427.jpg',NULL,'2026-06-12 14:46:02.024431+00'),
('c63cb2e0-d824-460f-8344-8f8105bac3ed','72f34512-113f-4c02-b638-0ddf3236d2a9','Gold Loop Drawer Pulls','Each','0.2','5','inventory-c63cb2e0-d824-460f-8344-8f8105bac3ed.jpg',NULL,'2026-06-12 14:49:38.887581+00'),
('983cfd71-04db-47d0-b718-91fb3870b4c4','72f34512-113f-4c02-b638-0ddf3236d2a9','5” Silver Modern Pull','Each','0.25','4','inventory-983cfd71-04db-47d0-b718-91fb3870b4c4.jpg',NULL,'2026-06-12 14:56:08.760588+00'),
('a436b844-b9a6-420c-903b-a29cb902a714','72f34512-113f-4c02-b638-0ddf3236d2a9','1” Diamond Ball Knob','Each','0.5','2','inventory-a436b844-b9a6-420c-903b-a29cb902a714.jpg',NULL,'2026-06-14 13:50:40.906404+00'),
('6760fc39-2301-4317-8d7d-28fd480a5fd7','72f34512-113f-4c02-b638-0ddf3236d2a9','Circle Oil-rubbed Bronze Vine Knob','Each','0.5','2','inventory-6760fc39-2301-4317-8d7d-28fd480a5fd7.jpg',NULL,'2026-06-14 13:52:00.476947+00'),
('81d9f864-a0a1-487c-a7b6-19f07be8af55','72f34512-113f-4c02-b638-0ddf3236d2a9','Circle Silver Knob w rings','Each','0.5','2','inventory-81d9f864-a0a1-487c-a7b6-19f07be8af55.jpg',NULL,'2026-06-14 13:53:33.240161+00'),
('7be04332-fb53-49fe-b644-67f4868afe50','72f34512-113f-4c02-b638-0ddf3236d2a9','Pink Flower Knob','Each','0.5','2','inventory-7be04332-fb53-49fe-b644-67f4868afe50.jpg',NULL,'2026-06-14 14:02:51.545333+00'),
('10a4cd9a-712b-4cb7-998c-d92d9bd4f662','72f34512-113f-4c02-b638-0ddf3236d2a9','Circle w Symbols Dark Brown Knob','Each','0.5','2','inventory-10a4cd9a-712b-4cb7-998c-d92d9bd4f662.jpg',NULL,'2026-06-14 14:07:11.529812+00'),
('0f6edf02-1891-4c55-a3c1-f7bb3acf0039','72f34512-113f-4c02-b638-0ddf3236d2a9','Circle w Symbols Dark Brown Knob','Each','0.5','2','inventory-0f6edf02-1891-4c55-a3c1-f7bb3acf0039.jpg',NULL,'2026-06-14 14:07:12.799642+00'),
('8dd36fc1-dcce-402a-99a3-c7dbfd9a1b04','72f34512-113f-4c02-b638-0ddf3236d2a9','1” Circle Beveled Metal Knob','Each','0.3333333333333333','3','inventory-8dd36fc1-dcce-402a-99a3-c7dbfd9a1b04.jpg',NULL,'2026-06-14 14:09:40.531034+00'),
('27f43d8a-4980-4b92-a7bd-568a48138476','72f34512-113f-4c02-b638-0ddf3236d2a9','Circle Silver Knob w Rings','Each','0.5','2','inventory-27f43d8a-4980-4b92-a7bd-568a48138476.jpg',NULL,'2026-06-14 14:10:54.699632+00'),
('5a9eef5e-fd42-49f5-aa61-b8364e6c7d4c','72f34512-113f-4c02-b638-0ddf3236d2a9','2” Diamond Ball Knob','Each','0.5','2','inventory-5a9eef5e-fd42-49f5-aa61-b8364e6c7d4c.jpg',NULL,'2026-06-14 14:13:44.294031+00'),
('035f628c-3ebb-425e-b00a-f61ec34ffb0a','72f34512-113f-4c02-b638-0ddf3236d2a9','2” Diamond Ball Knob','Each','0.5','2','inventory-035f628c-3ebb-425e-b00a-f61ec34ffb0a.jpg',NULL,'2026-06-14 14:13:46.018811+00'),
('89784dfa-df79-4faa-bbf8-c130940afcd2','72f34512-113f-4c02-b638-0ddf3236d2a9','Circle Gold 1” Fleur Pattern','Each','0.5','2','inventory-89784dfa-df79-4faa-bbf8-c130940afcd2.jpg',NULL,'2026-06-14 14:20:01.377674+00'),
('0c86df4e-5164-410e-8274-1a88a280ae39','72f34512-113f-4c02-b638-0ddf3236d2a9','3-Level Drawer Slides','Pair','0.25','4','inventory-0c86df4e-5164-410e-8274-1a88a280ae39.jpg',NULL,'2026-06-14 14:21:32.808498+00'),
('a0f0a51e-4724-4bf6-a406-57c6f3d205ef','72f34512-113f-4c02-b638-0ddf3236d2a9','Circle Brown Mandala Knob','Each','0.5','2','inventory-a0f0a51e-4724-4bf6-a406-57c6f3d205ef.jpg',NULL,'2026-06-14 14:25:23.488274+00'),
('2c858bf3-baaa-41d8-abfe-a021059564a5','72f34512-113f-4c02-b638-0ddf3236d2a9','Circle Brown Mandala Knob','Each','0.5','2','inventory-2c858bf3-baaa-41d8-abfe-a021059564a5.jpg',NULL,'2026-06-14 14:25:24.632774+00'),
('201d3bd2-4a18-4715-8059-e79b37dd39ae','72f34512-113f-4c02-b638-0ddf3236d2a9','Antique Decorative Knobs','Each','0.3333333333333333','3','inventory-201d3bd2-4a18-4715-8059-e79b37dd39ae.jpg',NULL,'2026-06-14 14:26:15.272534+00'),
('a839023f-be27-45fa-8ce0-d5eedb48ebca','72f34512-113f-4c02-b638-0ddf3236d2a9','Circle Silver beveled knob','Each','0.1','10','inventory-a839023f-be27-45fa-8ce0-d5eedb48ebca.jpg',NULL,'2026-06-16 12:16:45.214266+00')
on conflict (id) do nothing;

-- verify: expect items = 68
select count(*) as items, sum(quantity) as total_units
from public.books_inventory_items
where owner_user_id = '72f34512-113f-4c02-b638-0ddf3236d2a9';
