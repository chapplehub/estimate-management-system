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

drop table if exists estimates,
estimate_details,
orders,
order_details,
price_request_groups,
prices,
standard_prices,
customer_prices,
applications,
approvals,
products,
product_relations,
set_products,
users,
roles,
positions cascade;

create table estimates (
  id bigint primary key generated always as identity,
  original_estimate_id bigint,
  status_id bigint not null,
  type_id bigint not null,
  estimate_date date not null,
  deadline_date date not null,
  customer_type_id bigint not null,
  preferred_customer_id bigint,
  delivery_customer_id bigint
);

create table estimate_details (
  id bigint primary key generated always as identity,
  product_id bigint not null,
  quantity int not null,
  output_type text not null
);

create table orders (
  estimate_id bigint primary key,
  status_id bigint not null,
  type_id bigint not null,
  estimate_date date not null,
  deadline_date date not null,
  customer_type_id bigint not null,
  preferred_customer_id bigint,
  delivery_customer_id bigint
);

create table order_details (
  id bigint primary key generated always as identity,
  estimate_detail_id bigint,
  product_id bigint not null,
  quantity int not null,
  output_type text not null,
  status_id bigint not null
);

create table price_request_groups (
  id bigint primary key generated always as identity,
  reason_type text not null,
  reason_detail text not null,
  name text not null
);

create table prices (
  id bigint primary key generated always as identity,
  product_id bigint not null,
  date date not null
);

create table standard_prices (
  price_id bigint primary key,
  price numeric not null
);

create table customer_prices (
  price_id bigint primary key,
  request_group_id bigint not null,
  customer_type_id bigint not null,
  customer_id bigint not null,
  price numeric not null
);

create table applications (
  id bigint primary key generated always as identity,
  type_id bigint not null,
  status text,
  user_id bigint not null
);

create table approvals (
  id bigint primary key generated always as identity,
  application_id bigint,
  user_id bigint not null
);

create table products (
  id bigint primary key generated always as identity,
  category_id bigint,
  name text not null,
  unit_id bigint not null
);

create table product_relations (
  product_id bigint not null,
  related_product_id bigint not null,
  primary key (product_id, related_product_id)
);

create table set_products (
  set_product_id bigint not null,
  component_product_id bigint not null,
  primary key (set_product_id, component_product_id)
);

create table users (
  id bigint primary key generated always as identity,
  superior_role_id bigint,
  name text not null,
  department_id bigint
);

create table roles (
  id bigint primary key generated always as identity,
  superior_role_id bigint,
  position_id bigint not null,
  name text not null
);

create table positions (
  id bigint primary key generated always as identity,
  superior_position_id bigint,
  name text not null
);

create table if not exists estimate_status (
  id bigint primary key generated always as identity,
  name text not null
);

create table if not exists estimate_types (
  id bigint primary key generated always as identity,
  name text not null
);

create table if not exists customer_types (
  id bigint primary key generated always as identity,
  name text not null
);

create table if not exists order_status (
  id bigint primary key generated always as identity,
  name text not null
);

create table if not exists application_types (
  id bigint primary key generated always as identity,
  name text not null
);

create table if not exists units (
  id bigint primary key generated always as identity,
  name text not null
);

create table if not exists departments (
  id bigint primary key generated always as identity,
  name text not null
);

alter table estimates
add constraint fk_estimates_original_estimate foreign key (original_estimate_id) references estimates (id),
add constraint fk_estimates_status foreign key (status_id) references estimate_status (id),
add constraint fk_estimates_type foreign key (type_id) references estimate_types (id),
add constraint fk_estimates_customer_type foreign key (customer_type_id) references customer_types (id),
add constraint fk_estimates_preferred_customer foreign key (preferred_customer_id) references customers (id),
add constraint fk_estimates_delivery_customer foreign key (delivery_customer_id) references customers (id);

alter table estimate_details
add constraint fk_estimate_details_product foreign key (product_id) references products (id);

alter table orders
add constraint fk_orders_status foreign key (status_id) references order_status (id),
add constraint fk_orders_type foreign key (type_id) references estimate_types (id),
add constraint fk_orders_customer_type foreign key (customer_type_id) references customer_types (id),
add constraint fk_orders_preferred_customer foreign key (preferred_customer_id) references customers (id),
add constraint fk_orders_delivery_customer foreign key (delivery_customer_id) references customers (id);

alter table order_details
add constraint fk_order_details_estimate_detail foreign key (estimate_detail_id) references estimate_details (id),
add constraint fk_order_details_product foreign key (product_id) references products (id),
add constraint fk_order_details_status foreign key (status_id) references order_status (id);

alter table customer_prices
add constraint fk_customer_prices_request_group foreign key (request_group_id) references price_request_groups (id),
add constraint fk_customer_prices_customer_type foreign key (customer_type_id) references customer_types (id),
add constraint fk_customer_prices_customer foreign key (customer_id) references customers (id);

alter table applications
add constraint fk_applications_type foreign key (type_id) references application_types (id),
add constraint fk_applications_user foreign key (user_id) references users (id);

alter table approvals
add constraint fk_approvals_application foreign key (application_id) references applications (id),
add constraint fk_approvals_user foreign key (user_id) references users (id);

alter table products
add constraint fk_products_category foreign key (category_id) references product_categories (id),
add constraint fk_products_unit foreign key (unit_id) references units (id);

alter table product_relations
add constraint fk_product_relations_product foreign key (product_id) references products (id),
add constraint fk_product_relations_related_product foreign key (related_product_id) references products (id);

alter table set_products
add constraint fk_set_products_set_product foreign key (set_product_id) references products (id),
add constraint fk_set_products_component_product foreign key (component_product_id) references products (id);

alter table users
add constraint fk_users_superior_role foreign key (superior_role_id) references roles (id),
add constraint fk_users_department foreign key (department_id) references departments (id);

alter table roles
add constraint fk_roles_superior_role foreign key (superior_role_id) references roles (id),
add constraint fk_roles_position foreign key (position_id) references positions (id);

alter table positions
add constraint fk_positions_superior_position foreign key (superior_position_id) references positions (id);