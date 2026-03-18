import { createId } from "@paralleldrive/cuid2";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient } from "../generated/prisma/client";
import type { UserRole } from "../src/server/shared/auth/types";
import { USER_ROLES } from "../src/server/shared/auth/types";

config({ path: ".env" });

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

// デフォルトパスワード（開発環境用）
const DEFAULT_PASSWORD = "pass123!";

// 生成する従業員数
const TOTAL_EMPLOYEES = 2000;
// 管理者の割合（約5%）
const ADMIN_RATIO = 0.05;
// バッチサイズ（進捗表示用）
const BATCH_SIZE = 100;

// 日本人の姓リスト
const LAST_NAMES = [
  "佐藤",
  "鈴木",
  "高橋",
  "田中",
  "伊藤",
  "渡辺",
  "山本",
  "中村",
  "小林",
  "加藤",
  "吉田",
  "山田",
  "佐々木",
  "山口",
  "松本",
  "井上",
  "木村",
  "林",
  "斎藤",
  "清水",
  "山崎",
  "森",
  "池田",
  "橋本",
  "阿部",
  "石川",
  "山下",
  "中島",
  "石井",
  "小川",
  "前田",
  "岡田",
  "長谷川",
  "藤田",
  "後藤",
  "近藤",
  "村上",
  "遠藤",
  "青木",
  "坂本",
  "斉藤",
  "福田",
  "太田",
  "西村",
  "藤井",
  "金子",
  "三浦",
  "藤原",
  "岡本",
  "松田",
];

// 日本人の名リスト
const FIRST_NAMES = [
  "太郎",
  "次郎",
  "三郎",
  "一郎",
  "健太",
  "翔太",
  "大輝",
  "拓也",
  "直樹",
  "和也",
  "花子",
  "愛子",
  "美咲",
  "さくら",
  "陽子",
  "恵子",
  "真由美",
  "裕子",
  "智子",
  "由美",
  "大介",
  "健一",
  "誠",
  "隆",
  "浩",
  "剛",
  "修",
  "亮",
  "学",
  "豊",
  "麻衣",
  "彩",
  "舞",
  "遥",
  "凛",
  "葵",
  "結衣",
  "美優",
  "楓",
  "桃子",
  "翔",
  "蓮",
  "悠真",
  "颯太",
  "湊",
  "陽翔",
  "朝陽",
  "結翔",
  "悠斗",
  "駿",
];

interface SeedUser {
  employeeCd: string;
  email: string;
  name: string;
  role: UserRole;
  departmentId: string;
}

// 部署リスト
const DEPARTMENTS = [
  {
    id: "dept-001",
    departmentCd: "DEPT001",
    name: "営業部",
    abbreviation: "営業",
  },
  {
    id: "dept-002",
    departmentCd: "DEPT002",
    name: "開発部",
    abbreviation: "開発",
  },
  {
    id: "dept-003",
    departmentCd: "DEPT003",
    name: "総務部",
    abbreviation: "総務",
  },
  {
    id: "dept-004",
    departmentCd: "DEPT004",
    name: "人事部",
    abbreviation: "人事",
  },
  {
    id: "dept-005",
    departmentCd: "DEPT005",
    name: "経理部",
    abbreviation: "経理",
  },
];

// 得意先・納品先データ
const CUSTOMERS = [
  {
    code: "C001",
    name: "株式会社山田製作所",
    postalCode: "1000001",
    prefecture: "東京都",
    address: "千代田区千代田1-1-1",
    phoneNumber: "0312345678",
    faxNumber: "0312345679",
    contactPerson: "山田 太郎",
    marginRate: 10,
    deliveryLocations: [
      {
        code: "D001",
        name: "山田製作所 東京倉庫",
        postalCode: "1350061",
        prefecture: "東京都",
        address: "江東区豊洲3-2-1",
        phoneNumber: "0362345678",
        deliveryNotes: "平日9:00-17:00のみ受付",
      },
      {
        code: "D002",
        name: "山田製作所 埼玉工場",
        postalCode: "3300801",
        prefecture: "埼玉県",
        address: "さいたま市大宮区土手町1-10-5",
        phoneNumber: "0486001234",
        deliveryNotes: "正門からお入りください",
      },
    ],
  },
  {
    code: "C002",
    name: "東京電子工業株式会社",
    postalCode: "1600023",
    prefecture: "東京都",
    address: "新宿区西新宿2-8-1",
    phoneNumber: "0333456789",
    faxNumber: "0333456780",
    contactPerson: "鈴木 一郎",
    marginRate: 15,
    deliveryLocations: [
      {
        code: "D003",
        name: "東京電子 新宿本社",
        postalCode: "1600023",
        prefecture: "東京都",
        address: "新宿区西新宿2-8-1 B1F",
        phoneNumber: "0333456781",
        deliveryNotes: "地下搬入口よりお願いします",
      },
      {
        code: "D004",
        name: "東京電子 川崎物流センター",
        postalCode: "2100001",
        prefecture: "神奈川県",
        address: "川崎市川崎区本町1-5-3",
        phoneNumber: "0442001234",
        deliveryNotes: null,
      },
      {
        code: "D005",
        name: "東京電子 横浜研究所",
        postalCode: "2200012",
        prefecture: "神奈川県",
        address: "横浜市西区みなとみらい4-1-2",
        phoneNumber: "0454561234",
        deliveryNotes: "守衛室で受付後、第2棟へ",
      },
    ],
  },
  {
    code: "C003",
    name: "大阪機械工業株式会社",
    postalCode: "5300001",
    prefecture: "大阪府",
    address: "大阪市北区梅田1-3-1",
    phoneNumber: "0661234567",
    faxNumber: "0661234568",
    contactPerson: "田中 健太",
    marginRate: 12,
    deliveryLocations: [
      {
        code: "D006",
        name: "大阪機械 梅田本社",
        postalCode: "5300001",
        prefecture: "大阪府",
        address: "大阪市北区梅田1-3-1 5F",
        phoneNumber: "0661234569",
        deliveryNotes: "エレベーターは貨物用をご利用ください",
      },
      {
        code: "D007",
        name: "大阪機械 堺工場",
        postalCode: "5900001",
        prefecture: "大阪府",
        address: "堺市堺区北丸保園1-1",
        phoneNumber: "0722001234",
        deliveryNotes: "平日8:30-16:30受付",
      },
    ],
  },
  {
    code: "C004",
    name: "中部精密株式会社",
    postalCode: "4500002",
    prefecture: "愛知県",
    address: "名古屋市中村区名駅4-7-1",
    phoneNumber: "0521234567",
    faxNumber: null,
    contactPerson: "伊藤 直樹",
    marginRate: 8,
    deliveryLocations: [
      {
        code: "D008",
        name: "中部精密 名古屋本社",
        postalCode: "4500002",
        prefecture: "愛知県",
        address: "名古屋市中村区名駅4-7-1 3F",
        phoneNumber: "0521234568",
        deliveryNotes: null,
      },
      {
        code: "D009",
        name: "中部精密 豊田工場",
        postalCode: "4710035",
        prefecture: "愛知県",
        address: "豊田市小坂町12-50",
        phoneNumber: "0565321234",
        deliveryNotes: "東門から搬入",
      },
      {
        code: "D010",
        name: "中部精密 岡崎倉庫",
        postalCode: "4440038",
        prefecture: "愛知県",
        address: "岡崎市伝馬通2-1",
        phoneNumber: "0564221234",
        deliveryNotes: "午前中のみ受付可",
      },
    ],
  },
  {
    code: "C005",
    name: "九州鉄鋼株式会社",
    postalCode: "8120011",
    prefecture: "福岡県",
    address: "福岡市博多区博多駅前3-2-1",
    phoneNumber: "0921234567",
    faxNumber: "0921234568",
    contactPerson: "渡辺 修",
    marginRate: 20,
    deliveryLocations: [
      {
        code: "D011",
        name: "九州鉄鋼 博多本社",
        postalCode: "8120011",
        prefecture: "福岡県",
        address: "福岡市博多区博多駅前3-2-1 8F",
        phoneNumber: "0921234569",
        deliveryNotes: null,
      },
      {
        code: "D012",
        name: "九州鉄鋼 北九州工場",
        postalCode: "8020001",
        prefecture: "福岡県",
        address: "北九州市小倉北区浅野1-1-1",
        phoneNumber: "0935001234",
        deliveryNotes: "大型車両は西門から",
      },
    ],
  },
  {
    code: "C006",
    name: "北海道食品加工株式会社",
    postalCode: "0600001",
    prefecture: "北海道",
    address: "札幌市中央区北一条西2-1",
    phoneNumber: "0112345678",
    faxNumber: "0112345679",
    contactPerson: "佐藤 花子",
    marginRate: 18,
    deliveryLocations: [
      {
        code: "D013",
        name: "北海道食品 札幌本社",
        postalCode: "0600001",
        prefecture: "北海道",
        address: "札幌市中央区北一条西2-1 2F",
        phoneNumber: "0112345680",
        deliveryNotes: "冷蔵車のみ搬入可",
      },
      {
        code: "D014",
        name: "北海道食品 旭川工場",
        postalCode: "0700033",
        prefecture: "北海道",
        address: "旭川市三条通8丁目",
        phoneNumber: "0166231234",
        deliveryNotes: "冬季は事前連絡必須",
      },
      {
        code: "D015",
        name: "北海道食品 帯広倉庫",
        postalCode: "0800012",
        prefecture: "北海道",
        address: "帯広市西二条南9-1",
        phoneNumber: "0155241234",
        deliveryNotes: null,
      },
    ],
  },
  {
    code: "C007",
    name: "東北建材株式会社",
    postalCode: "9800021",
    prefecture: "宮城県",
    address: "仙台市青葉区中央1-3-1",
    phoneNumber: "0222345678",
    faxNumber: null,
    contactPerson: "高橋 誠",
    marginRate: 15,
    deliveryLocations: [
      {
        code: "D016",
        name: "東北建材 仙台本社",
        postalCode: "9800021",
        prefecture: "宮城県",
        address: "仙台市青葉区中央1-3-1 4F",
        phoneNumber: "0222345679",
        deliveryNotes: "1Fエントランスで受付",
      },
      {
        code: "D017",
        name: "東北建材 郡山営業所",
        postalCode: "9638002",
        prefecture: "福島県",
        address: "郡山市駅前2-10-16",
        phoneNumber: "0249321234",
        deliveryNotes: null,
      },
    ],
  },
  {
    code: "C008",
    name: "関西化学工業株式会社",
    postalCode: "6000008",
    prefecture: "京都府",
    address: "京都市下京区四条通烏丸東入",
    phoneNumber: "0752345678",
    faxNumber: "0752345679",
    contactPerson: "中村 美咲",
    marginRate: 22,
    deliveryLocations: [
      {
        code: "D018",
        name: "関西化学 京都本社",
        postalCode: "6000008",
        prefecture: "京都府",
        address: "京都市下京区四条通烏丸東入 6F",
        phoneNumber: "0752345680",
        deliveryNotes: "危険物搬入は事前申請要",
      },
      {
        code: "D019",
        name: "関西化学 滋賀工場",
        postalCode: "5200025",
        prefecture: "滋賀県",
        address: "大津市皇子が丘2-1-1",
        phoneNumber: "0775231234",
        deliveryNotes: "保護具着用のこと",
      },
    ],
  },
  {
    code: "C009",
    name: "四国紙業株式会社",
    postalCode: "7600023",
    prefecture: "香川県",
    address: "高松市寿町1-1-12",
    phoneNumber: "0878345678",
    faxNumber: "0878345679",
    contactPerson: "小林 拓也",
    marginRate: 7,
    deliveryLocations: [
      {
        code: "D020",
        name: "四国紙業 高松本社",
        postalCode: "7600023",
        prefecture: "香川県",
        address: "高松市寿町1-1-12 3F",
        phoneNumber: "0878345680",
        deliveryNotes: null,
      },
      {
        code: "D021",
        name: "四国紙業 松山工場",
        postalCode: "7900001",
        prefecture: "愛媛県",
        address: "松山市一番町4-2",
        phoneNumber: "0899411234",
        deliveryNotes: "雨天時は屋内搬入口へ",
      },
    ],
  },
  {
    code: "C010",
    name: "信越電装株式会社",
    postalCode: "3800838",
    prefecture: "長野県",
    address: "長野市県町484-1",
    phoneNumber: "0262345678",
    faxNumber: null,
    contactPerson: "加藤 大輝",
    marginRate: 13,
    deliveryLocations: [
      {
        code: "D022",
        name: "信越電装 長野本社",
        postalCode: "3800838",
        prefecture: "長野県",
        address: "長野市県町484-1 2F",
        phoneNumber: "0262345679",
        deliveryNotes: null,
      },
      {
        code: "D023",
        name: "信越電装 上田工場",
        postalCode: "3860012",
        prefecture: "長野県",
        address: "上田市中央2-5-10",
        phoneNumber: "0268221234",
        deliveryNotes: "駐車場は第2をご利用ください",
      },
      {
        code: "D024",
        name: "信越電装 新潟営業所",
        postalCode: "9500087",
        prefecture: "新潟県",
        address: "新潟市中央区東大通1-2-25",
        phoneNumber: "0252451234",
        deliveryNotes: "ビル裏手の搬入口から",
      },
    ],
  },
  {
    code: "C011",
    name: "広島重工業株式会社",
    postalCode: "7300011",
    prefecture: "広島県",
    address: "広島市中区基町6-78",
    phoneNumber: "0822345678",
    faxNumber: "0822345679",
    contactPerson: "山本 和也",
    marginRate: 25,
    deliveryLocations: [
      {
        code: "D025",
        name: "広島重工 広島本社",
        postalCode: "7300011",
        prefecture: "広島県",
        address: "広島市中区基町6-78 10F",
        phoneNumber: "0822345680",
        deliveryNotes: "貨物エレベーター使用",
      },
      {
        code: "D026",
        name: "広島重工 呉造船所",
        postalCode: "7370046",
        prefecture: "広島県",
        address: "呉市中通1-1-1",
        phoneNumber: "0823211234",
        deliveryNotes: "入構許可証が必要",
      },
    ],
  },
  {
    code: "C012",
    name: "沖縄物産株式会社",
    postalCode: "9000015",
    prefecture: "沖縄県",
    address: "那覇市久茂地3-1-1",
    phoneNumber: "0988345678",
    faxNumber: null,
    contactPerson: "島袋 陽子",
    marginRate: 5,
    deliveryLocations: [
      {
        code: "D027",
        name: "沖縄物産 那覇本社",
        postalCode: "9000015",
        prefecture: "沖縄県",
        address: "那覇市久茂地3-1-1 7F",
        phoneNumber: "0988345679",
        deliveryNotes: "台風時は事前連絡ください",
      },
      {
        code: "D028",
        name: "沖縄物産 浦添倉庫",
        postalCode: "9012101",
        prefecture: "沖縄県",
        address: "浦添市西原1-3-5",
        phoneNumber: "0988771234",
        deliveryNotes: null,
      },
    ],
  },
  {
    code: "C013",
    name: "北陸繊維工業株式会社",
    postalCode: "9200961",
    prefecture: "石川県",
    address: "金沢市香林坊2-1-1",
    phoneNumber: "0762345678",
    faxNumber: "0762345679",
    contactPerson: "前田 恵子",
    marginRate: 11,
    deliveryLocations: [
      {
        code: "D029",
        name: "北陸繊維 金沢本社",
        postalCode: "9200961",
        prefecture: "石川県",
        address: "金沢市香林坊2-1-1 4F",
        phoneNumber: "0762345680",
        deliveryNotes: "検品室へ直接搬入",
      },
      {
        code: "D030",
        name: "北陸繊維 富山工場",
        postalCode: "9300005",
        prefecture: "富山県",
        address: "富山市新桜町7-38",
        phoneNumber: "0764321234",
        deliveryNotes: null,
      },
      {
        code: "D031",
        name: "北陸繊維 福井倉庫",
        postalCode: "9100005",
        prefecture: "福井県",
        address: "福井市大手3-17-1",
        phoneNumber: "0776201234",
        deliveryNotes: "土曜日も午前中は受付可",
      },
    ],
  },
  {
    code: "C014",
    name: "山陰食品株式会社",
    postalCode: "6900003",
    prefecture: "島根県",
    address: "松江市朝日町590",
    phoneNumber: "0852345678",
    faxNumber: "0852345679",
    contactPerson: "松本 翔太",
    marginRate: 9,
    deliveryLocations: [
      {
        code: "D032",
        name: "山陰食品 松江本社",
        postalCode: "6900003",
        prefecture: "島根県",
        address: "松江市朝日町590 2F",
        phoneNumber: "0852345680",
        deliveryNotes: "冷蔵品は裏口の冷蔵搬入口へ",
      },
      {
        code: "D033",
        name: "山陰食品 鳥取工場",
        postalCode: "6800022",
        prefecture: "鳥取県",
        address: "鳥取市西町1-201",
        phoneNumber: "0857221234",
        deliveryNotes: null,
      },
    ],
  },
  {
    code: "C015",
    name: "南九州農機株式会社",
    postalCode: "8900053",
    prefecture: "鹿児島県",
    address: "鹿児島市中央町10",
    phoneNumber: "0992345678",
    faxNumber: null,
    contactPerson: "黒田 剛",
    marginRate: 16,
    deliveryLocations: [
      {
        code: "D034",
        name: "南九州農機 鹿児島本社",
        postalCode: "8900053",
        prefecture: "鹿児島県",
        address: "鹿児島市中央町10 5F",
        phoneNumber: "0992345679",
        deliveryNotes: null,
      },
      {
        code: "D035",
        name: "南九州農機 宮崎営業所",
        postalCode: "8800805",
        prefecture: "宮崎県",
        address: "宮崎市橘通東4-8-1",
        phoneNumber: "0985241234",
        deliveryNotes: "農機具は屋外展示場へ搬入",
      },
      {
        code: "D036",
        name: "南九州農機 熊本倉庫",
        postalCode: "8600808",
        prefecture: "熊本県",
        address: "熊本市中央区手取本町1-1",
        phoneNumber: "0963521234",
        deliveryNotes: "大型車両進入可",
      },
    ],
  },
];

// ランダムな要素を取得
function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

// 従業員コードを生成（EMP000001形式）
function generateEmployeeCd(index: number): string {
  return `EMP${String(index).padStart(6, "0")}`;
}

// ランダムな名前を生成
function generateName(): string {
  const lastName = randomChoice(LAST_NAMES);
  const firstName = randomChoice(FIRST_NAMES);
  return `${lastName} ${firstName}`;
}

// メールアドレスを生成
function generateEmail(index: number): string {
  return `employee${index}@example.com`;
}

// 役割を決定（約5%が管理者）
function determineRole(index: number): UserRole {
  // 最初の1人は必ず管理者
  if (index === 1) return USER_ROLES.ADMIN;
  // それ以降は確率で決定
  return Math.random() < ADMIN_RATIO ? USER_ROLES.ADMIN : USER_ROLES.USER;
}

// シードユーザーデータを生成
function generateSeedUsers(count: number): SeedUser[] {
  const users: SeedUser[] = [];
  for (let i = 1; i <= count; i++) {
    users.push({
      employeeCd: generateEmployeeCd(i),
      email: generateEmail(i),
      name: generateName(),
      role: determineRole(i),
      departmentId: randomChoice(DEPARTMENTS).id,
    });
  }
  return users;
}

async function createUserWithEmployee(userData: SeedUser, hashedPassword: string) {
  const employeeId = createId();
  const userId = createId();
  const accountId = createId();

  // トランザクションでEmployee, User, Accountを一括作成
  const result = await prisma.$transaction(async (tx) => {
    // 1. Employeeを作成
    const employee = await tx.employee.create({
      data: {
        id: employeeId,
        employeeCd: userData.employeeCd,
        email: userData.email,
        name: userData.name,
        departmentId: userData.departmentId,
      },
    });

    // 2. Userを作成（Employeeとリンク）
    const user = await tx.user.create({
      data: {
        id: userId,
        name: userData.name,
        email: userData.email,
        emailVerified: true, // 開発環境では検証済みとして扱う
        employeeId: employeeId,
        role: userData.role, // Admin Pluginで使用する権限
      },
    });

    // 3. Accountを作成（ハッシュ化されたパスワードで）
    await tx.account.create({
      data: {
        id: accountId,
        accountId: userId,
        providerId: "credential",
        userId: userId,
        password: hashedPassword,
      },
    });

    return { employee, user };
  });

  return result;
}

async function seedCustomersAndDeliveryLocations() {
  console.log("Creating customers and delivery locations...");
  let customerCount = 0;
  let deliveryLocationCount = 0;

  for (const customerData of CUSTOMERS) {
    // Company + Customer を作成
    const companyId = createId();
    const customerId = createId();

    await prisma.$transaction(async (tx) => {
      await tx.company.create({
        data: {
          id: companyId,
          code: customerData.code,
          name: customerData.name,
          type: "CUSTOMER",
          postalCode: customerData.postalCode,
          prefecture: customerData.prefecture,
          address: customerData.address,
          phoneNumber: customerData.phoneNumber,
          faxNumber: customerData.faxNumber,
          contactPerson: customerData.contactPerson,
          isActive: true,
        },
      });

      await tx.customer.create({
        data: {
          id: customerId,
          companyId: companyId,
          marginRate: customerData.marginRate,
        },
      });
    });

    customerCount++;

    // 各納品先を作成
    for (const dlData of customerData.deliveryLocations) {
      const dlCompanyId = createId();
      const dlId = createId();

      await prisma.$transaction(async (tx) => {
        await tx.company.create({
          data: {
            id: dlCompanyId,
            code: dlData.code,
            name: dlData.name,
            type: "DELIVERY_LOCATION",
            postalCode: dlData.postalCode,
            prefecture: dlData.prefecture,
            address: dlData.address,
            phoneNumber: dlData.phoneNumber,
            faxNumber: null,
            contactPerson: null,
            isActive: true,
          },
        });

        await tx.deliveryLocation.create({
          data: {
            id: dlId,
            companyId: dlCompanyId,
            customerId: customerId,
            deliveryNotes: dlData.deliveryNotes,
          },
        });
      });

      deliveryLocationCount++;
    }

    console.log(
      `  Created: ${customerData.name} (${customerData.deliveryLocations.length} delivery locations)`
    );
  }

  console.log("");
  console.log(`Created ${customerCount} customers and ${deliveryLocationCount} delivery locations`);
  console.log("");

  return { customerCount, deliveryLocationCount };
}

async function main() {
  console.log("Start seeding...");
  console.log(`Generating ${TOTAL_EMPLOYEES} employees...`);
  console.log("");

  // 既存データを削除（外部キー制約を考慮した順序）
  await prisma.deliveryLocation.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.company.deleteMany();
  await prisma.account.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.department.deleteMany();
  console.log("Deleted existing data");
  console.log("");

  // 部署を作成
  console.log("Creating departments...");
  for (const dept of DEPARTMENTS) {
    await prisma.department.create({
      data: {
        id: dept.id,
        departmentCd: dept.departmentCd,
        name: dept.name,
        abbreviation: dept.abbreviation,
        isActive: true,
      },
    });
  }
  console.log(`Created ${DEPARTMENTS.length} departments`);
  console.log("");

  // 得意先・納品先を作成
  const { customerCount, deliveryLocationCount } = await seedCustomersAndDeliveryLocations();

  // パスワードは全員同じなので、事前に1回だけハッシュ化
  console.log("Hashing password...");
  const hashedPassword = await hashPassword(DEFAULT_PASSWORD);
  console.log("Password hashed");
  console.log("");

  // ユーザーデータを生成
  const users = generateSeedUsers(TOTAL_EMPLOYEES);
  let adminCount = 0;
  let userCount = 0;

  // 各ユーザーを作成（バッチごとに進捗表示）
  console.log("Creating users...");
  const startTime = Date.now();

  for (let i = 0; i < users.length; i++) {
    const userData = users[i];
    await createUserWithEmployee(userData, hashedPassword);

    if (userData.role === USER_ROLES.ADMIN) {
      adminCount++;
    } else {
      userCount++;
    }

    // 進捗表示（バッチサイズごと、または最後）
    if ((i + 1) % BATCH_SIZE === 0 || i + 1 === users.length) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const percent = (((i + 1) / users.length) * 100).toFixed(1);
      process.stdout.write(
        `\r  Progress: ${i + 1}/${users.length} (${percent}%) - ${elapsed}s elapsed`
      );
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("");
  console.log("");
  console.log("=".repeat(50));
  console.log("Seeding finished.");
  console.log(`Total time: ${totalTime}s`);
  console.log(`Created ${TOTAL_EMPLOYEES} employees:`);
  console.log(`  - Admins: ${adminCount}`);
  console.log(`  - Users: ${userCount}`);
  console.log(`Created ${customerCount} customers`);
  console.log(`Created ${deliveryLocationCount} delivery locations`);
  console.log(`Default password for all users: ${DEFAULT_PASSWORD}`);
  console.log("=".repeat(50));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
