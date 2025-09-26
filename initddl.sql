-- Migrations will appear here as you chat with AI

create table product_categories (
  id bigint primary key generated always as identity,
  name text not null check (name in ('個別商品', '消耗品', 'セット商品'))
);

create table customers (
  id bigint primary key generated always as identity,
  name text not null,
  type text not null check (type in ('得意先', '納品先'))
);

create table products (
  id bigint primary key generated always as identity,
  name text not null,
  category_id bigint not null,
  foreign key (category_id) references product_categories (id)
);

create table estimates (
  id bigint primary key generated always as identity,
  type text not null check (type in ('新規見積', '修理見積', '事後見積')),
  status text not null check (status in ('進行中', '申請中', '差戻', '取下', '受注済')),
  submission_type text not null check (submission_type in ('得意先', '納品先')),
  customer_id bigint not null,
  foreign key (customer_id) references customers (id)
);

create table orders (
  id bigint primary key generated always as identity,
  estimate_id bigint not null,
  status text not null check (status in ('進行中', '確定済', '変更禁止', '取下')),
  instructions text,
  foreign key (estimate_id) references estimates (id)
);

create table prices (
  id bigint primary key generated always as identity,
  product_id bigint not null,
  date date not null,
  foreign key (product_id) references products (id)
);

create table standard_prices (
  price_id bigint primary key,
  price numeric not null,
  foreign key (price_id) references prices (id)
);

create table customer_prices (
  price_id bigint primary key,
  group_id bigint not null,
  customer_type_id bigint not null,
  customer_id bigint not null,
  price numeric not null,
  foreign key (price_id) references prices (id)
);

create table users (
  id bigint primary key generated always as identity,
  role_id bigint not null,
  name text not null,
  department_id bigint
);

create table roles (
  id bigint primary key generated always as identity,
  name text not null,
  type text not null check (type in ('個人役割', '役職役割')),
  superior_role_id bigint
);

create table user_roles (
  user_id bigint not null,
  role_id bigint not null,
  primary key (user_id, role_id),
  foreign key (user_id) references users (id),
  foreign key (role_id) references roles (id)
);

create table positions (
  id bigint primary key generated always as identity,
  name text not null,
  superior_position_id bigint
);

create table user_positions (
  user_id bigint not null,
  position_id bigint not null,
  primary key (user_id, position_id),
  foreign key (user_id) references users (id),
  foreign key (position_id) references positions (id)
);