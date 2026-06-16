import { generateId } from "../src/server/shared/generateId";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient } from "../generated/prisma/client";
import type { UserRole } from "../src/server/shared/auth/types";
import { USER_ROLES } from "../src/server/shared/auth/types";
import { seedEstimates } from "./seed-estimates";

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
  superiorRoleId: string | null;
  assignedRoleId?: string; // 役割を持つ従業員の場合
}

// 部署リスト
const DEPARTMENTS = [
  { departmentCd: "DEPT001", name: "営業部", abbreviation: "営業" },
  { departmentCd: "DEPT002", name: "開発部", abbreviation: "開発" },
  { departmentCd: "DEPT003", name: "総務部", abbreviation: "総務" },
  { departmentCd: "DEPT004", name: "人事部", abbreviation: "人事" },
  { departmentCd: "DEPT005", name: "経理部", abbreviation: "経理" },
];

// 役職リスト（cdで定義、idはシード時にCUID生成）
const POSITIONS = [
  { cd: "POS001", name: "課長", superiorCd: "POS002" as string | null },
  { cd: "POS002", name: "部長", superiorCd: "POS003" as string | null },
  { cd: "POS003", name: "本部長", superiorCd: "POS004" as string | null },
  { cd: "POS004", name: "社長", superiorCd: null },
];

// 役割リスト（cdで定義、FK参照はcd経由で解決）
const ROLES = [
  // 社長（最上位）
  { cd: "ROLE001", name: "社長", positionCd: "POS004", superiorCd: null as string | null },
  // 本部長
  {
    cd: "ROLE002",
    name: "営業本部長",
    positionCd: "POS003",
    superiorCd: "ROLE001" as string | null,
  },
  {
    cd: "ROLE003",
    name: "管理本部長",
    positionCd: "POS003",
    superiorCd: "ROLE001" as string | null,
  },
  // 部長
  { cd: "ROLE004", name: "営業部長", positionCd: "POS002", superiorCd: "ROLE002" as string | null },
  { cd: "ROLE005", name: "開発部長", positionCd: "POS002", superiorCd: "ROLE003" as string | null },
  { cd: "ROLE006", name: "総務部長", positionCd: "POS002", superiorCd: "ROLE003" as string | null },
  { cd: "ROLE007", name: "人事部長", positionCd: "POS002", superiorCd: "ROLE003" as string | null },
  { cd: "ROLE008", name: "経理部長", positionCd: "POS002", superiorCd: "ROLE003" as string | null },
  // 課長
  {
    cd: "ROLE009",
    name: "営業一課長",
    positionCd: "POS001",
    superiorCd: "ROLE004" as string | null,
  },
  {
    cd: "ROLE010",
    name: "営業二課長",
    positionCd: "POS001",
    superiorCd: "ROLE004" as string | null,
  },
  {
    cd: "ROLE011",
    name: "開発一課長",
    positionCd: "POS001",
    superiorCd: "ROLE005" as string | null,
  },
  {
    cd: "ROLE012",
    name: "開発二課長",
    positionCd: "POS001",
    superiorCd: "ROLE005" as string | null,
  },
  { cd: "ROLE013", name: "総務課長", positionCd: "POS001", superiorCd: "ROLE006" as string | null },
  { cd: "ROLE014", name: "人事課長", positionCd: "POS001", superiorCd: "ROLE007" as string | null },
  { cd: "ROLE015", name: "経理課長", positionCd: "POS001", superiorCd: "ROLE008" as string | null },
];

// 役割を持つ従業員の設定（EMP000001〜EMP000015）
const ROLE_EMPLOYEE_CONFIGS = [
  { roleCd: "ROLE001", departmentCd: "DEPT001" }, // 社長 → 営業部（便宜上）
  { roleCd: "ROLE002", departmentCd: "DEPT001" }, // 営業本部長 → 営業部
  { roleCd: "ROLE003", departmentCd: "DEPT003" }, // 管理本部長 → 総務部
  { roleCd: "ROLE004", departmentCd: "DEPT001" }, // 営業部長 → 営業部
  { roleCd: "ROLE005", departmentCd: "DEPT002" }, // 開発部長 → 開発部
  { roleCd: "ROLE006", departmentCd: "DEPT003" }, // 総務部長 → 総務部
  { roleCd: "ROLE007", departmentCd: "DEPT004" }, // 人事部長 → 人事部
  { roleCd: "ROLE008", departmentCd: "DEPT005" }, // 経理部長 → 経理部
  { roleCd: "ROLE009", departmentCd: "DEPT001" }, // 営業一課長 → 営業部
  { roleCd: "ROLE010", departmentCd: "DEPT001" }, // 営業二課長 → 営業部
  { roleCd: "ROLE011", departmentCd: "DEPT002" }, // 開発一課長 → 開発部
  { roleCd: "ROLE012", departmentCd: "DEPT002" }, // 開発二課長 → 開発部
  { roleCd: "ROLE013", departmentCd: "DEPT003" }, // 総務課長 → 総務部
  { roleCd: "ROLE014", departmentCd: "DEPT004" }, // 人事課長 → 人事部
  { roleCd: "ROLE015", departmentCd: "DEPT005" }, // 経理課長 → 経理部
];

// 部署ごとの一般従業員の上位役割候補（roleCdで指定）
const DEPARTMENT_SUPERIOR_ROLE_CDS = new Map<string, string[]>([
  ["DEPT001", ["ROLE009", "ROLE010"]], // 営業部 → 営業一課長 or 営業二課長
  ["DEPT002", ["ROLE011", "ROLE012"]], // 開発部 → 開発一課長 or 開発二課長
  ["DEPT003", ["ROLE013"]], // 総務部 → 総務課長
  ["DEPT004", ["ROLE014"]], // 人事部 → 人事課長
  ["DEPT005", ["ROLE015"]], // 経理部 → 経理課長
]);

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

// 商品データ（開発用: 各区分・単位・有効/無効をカバー）
const PRODUCTS = [
  // 個別商品（INDIVIDUAL）
  {
    code: "PRD001",
    name: "標準デスク",
    category: "INDIVIDUAL" as const,
    unit: "UNIT" as const,
    costPrice: 15000,
    isActive: true,
    description: "W1200×D700×H720 標準サイズのオフィスデスク",
  },
  {
    code: "PRD002",
    name: "オフィスチェア",
    category: "INDIVIDUAL" as const,
    unit: "UNIT" as const,
    costPrice: 25000,
    isActive: true,
    description: "エルゴノミクスチェア メッシュバック",
  },
  {
    code: "PRD003",
    name: "モニターアーム",
    category: "INDIVIDUAL" as const,
    unit: "UNIT" as const,
    costPrice: 8000,
    isActive: true,
    description: "シングルモニター用 VESA対応",
  },
  {
    code: "PRD004",
    name: "キーボードトレイ",
    category: "INDIVIDUAL" as const,
    unit: "UNIT" as const,
    costPrice: 5000,
    isActive: true,
    description: "スライド式 後付けタイプ",
  },
  {
    code: "PRD005",
    name: "旧型モニター",
    category: "INDIVIDUAL" as const,
    unit: "UNIT" as const,
    costPrice: 20000,
    isActive: false,
    description: "販売終了品 24インチ液晶",
  },
  {
    code: "PRD006",
    name: "旧型プリンター",
    category: "INDIVIDUAL" as const,
    unit: "UNIT" as const,
    costPrice: 35000,
    isActive: false,
    description: "販売終了品 A3対応レーザー",
  },
  {
    code: "PRD007",
    name: "パーティション",
    category: "INDIVIDUAL" as const,
    unit: "SHEET" as const,
    costPrice: 12000,
    isActive: true,
    description: "H1800 自立式パーティション",
  },
  {
    code: "PRD008",
    name: "ケーブルダクト",
    category: "INDIVIDUAL" as const,
    unit: "ROLL" as const,
    costPrice: 3500,
    isActive: true,
    description: "床用ケーブルカバー 1m単位",
  },
  // 消耗品（CONSUMABLE）
  {
    code: "PRD009",
    name: "コピー用紙A4",
    category: "CONSUMABLE" as const,
    unit: "BOX" as const,
    costPrice: 3000,
    isActive: true,
    description: "A4 500枚×5冊入り",
  },
  {
    code: "PRD010",
    name: "コピー用紙A3",
    category: "CONSUMABLE" as const,
    unit: "BOX" as const,
    costPrice: 4500,
    isActive: true,
    description: "A3 500枚×3冊入り",
  },
  {
    code: "PRD011",
    name: "トナーカートリッジ黒",
    category: "CONSUMABLE" as const,
    unit: "PIECE" as const,
    costPrice: 8000,
    isActive: true,
    description: null,
  },
  {
    code: "PRD012",
    name: "トナーカートリッジカラー",
    category: "CONSUMABLE" as const,
    unit: "PIECE" as const,
    costPrice: 12000,
    isActive: true,
    description: "C/M/Y 3色セット",
  },
  {
    code: "PRD013",
    name: "クリーニングキット",
    category: "CONSUMABLE" as const,
    unit: "PIECE" as const,
    costPrice: 2500,
    isActive: true,
    description: "OA機器クリーニング用",
  },
  {
    code: "PRD014",
    name: "旧型トナー",
    category: "CONSUMABLE" as const,
    unit: "PIECE" as const,
    costPrice: 6000,
    isActive: false,
    description: "旧型プリンター用 在庫限り",
  },
  // セット商品（SET）
  {
    code: "PRD015",
    name: "デスクセット一式",
    category: "SET" as const,
    unit: "SET" as const,
    costPrice: null,
    isActive: true,
    description: "デスク＋チェアのセット",
  },
  {
    code: "PRD016",
    name: "モニター環境セット",
    category: "SET" as const,
    unit: "SET" as const,
    costPrice: null,
    isActive: true,
    description: "モニターアーム＋ケーブルダクトのセット",
  },
  {
    code: "PRD017",
    name: "印刷消耗品セット",
    category: "SET" as const,
    unit: "SET" as const,
    costPrice: null,
    isActive: true,
    description: "トナー＋用紙のまとめ買いセット",
  },
  {
    code: "PRD018",
    name: "旧型デスクセット",
    category: "SET" as const,
    unit: "SET" as const,
    costPrice: null,
    isActive: false,
    description: "販売終了セット商品",
  },
];

/**
 * セット構成（SetProductComponent・ADR-0047）。SET 商品 → 構成商品（個別/消耗品）の対応。
 * 自動展開（expandSetComponents）が構成を引けるよう、有効な SET 商品に構成を持たせる。
 */
const SET_COMPONENTS = [
  { setCode: "PRD015", componentCode: "PRD001", quantity: 1 }, // デスクセット = 標準デスク
  { setCode: "PRD015", componentCode: "PRD002", quantity: 1 }, //            + オフィスチェア
  { setCode: "PRD016", componentCode: "PRD003", quantity: 1 }, // モニター環境 = モニターアーム
  { setCode: "PRD016", componentCode: "PRD008", quantity: 2 }, //            + ケーブルダクト×2
  { setCode: "PRD017", componentCode: "PRD011", quantity: 1 }, // 印刷消耗品 = トナー黒
  { setCode: "PRD017", componentCode: "PRD009", quantity: 3 }, //            + コピー用紙A4×3
];

// 消費税率データ（昇順）
const TAX_RATES = [
  { rate: "0.080", effectiveFrom: new Date("2014-04-01T00:00:00+09:00") },
  { rate: "0.100", effectiveFrom: new Date("2019-10-01T00:00:00+09:00") },
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

// 固定ユーザー（画面上で管理者/一般ユーザを識別しやすくする）
const FIXED_USERS = [
  { name: "管理 ユーザ", role: USER_ROLES.ADMIN },
  { name: "一般 ユーザ", role: USER_ROLES.USER },
] as const;

// 役割を決定（約5%が管理者）
function determineRole(index: number): UserRole {
  // 固定ユーザーはFIXED_USERSで決定済み
  if (index <= FIXED_USERS.length) return FIXED_USERS[index - 1].role;
  // それ以降は確率で決定
  return Math.random() < ADMIN_RATIO ? USER_ROLES.ADMIN : USER_ROLES.USER;
}

// シードユーザーデータを生成（roleIdMap: roleCd → CUID, departmentIdMap: departmentCd → CUID）
function generateSeedUsers(
  count: number,
  roleIdMap: Map<string, string>,
  departmentIdMap: Map<string, string>
): SeedUser[] {
  const users: SeedUser[] = [];
  for (let i = 1; i <= count; i++) {
    if (i <= FIXED_USERS.length) {
      // 固定ユーザー（EMP000001: 管理ユーザ, EMP000002: 一般ユーザ）
      const fixedUser = FIXED_USERS[i - 1];
      const config = ROLE_EMPLOYEE_CONFIGS[i - 1];
      const assignedRole = ROLES.find((r) => r.cd === config.roleCd)!;
      const superiorRoleId = assignedRole.superiorCd
        ? roleIdMap.get(assignedRole.superiorCd)!
        : null;
      users.push({
        employeeCd: generateEmployeeCd(i),
        email: generateEmail(i),
        name: fixedUser.name,
        role: fixedUser.role,
        departmentId: departmentIdMap.get(config.departmentCd)!,
        superiorRoleId,
        assignedRoleId: roleIdMap.get(config.roleCd),
      });
    } else if (i <= ROLE_EMPLOYEE_CONFIGS.length) {
      // 役割を持つ従業員（EMP000003〜EMP000015）
      const config = ROLE_EMPLOYEE_CONFIGS[i - 1];
      const assignedRole = ROLES.find((r) => r.cd === config.roleCd)!;
      const superiorRoleId = assignedRole.superiorCd
        ? roleIdMap.get(assignedRole.superiorCd)!
        : null;
      users.push({
        employeeCd: generateEmployeeCd(i),
        email: generateEmail(i),
        name: generateName(),
        role: determineRole(i),
        departmentId: departmentIdMap.get(config.departmentCd)!,
        superiorRoleId,
        assignedRoleId: roleIdMap.get(config.roleCd),
      });
    } else {
      // 一般従業員（部署に応じた課長を上位役割に設定）
      const dept = randomChoice(DEPARTMENTS);
      const departmentId = departmentIdMap.get(dept.departmentCd)!;
      const candidateCds = DEPARTMENT_SUPERIOR_ROLE_CDS.get(dept.departmentCd)!;
      const superiorRoleCd = randomChoice(candidateCds);
      users.push({
        employeeCd: generateEmployeeCd(i),
        email: generateEmail(i),
        name: generateName(),
        role: determineRole(i),
        departmentId,
        superiorRoleId: roleIdMap.get(superiorRoleCd)!,
      });
    }
  }
  return users;
}

async function createUserWithEmployee(userData: SeedUser, hashedPassword: string) {
  const employeeId = generateId();
  const userId = generateId();
  const accountId = generateId();

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
        superiorRoleId: userData.superiorRoleId,
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
    // Customer を作成
    const customerId = generateId();

    await prisma.customer.create({
      data: {
        id: customerId,
        code: customerData.code,
        name: customerData.name,
        postalCode: customerData.postalCode,
        prefecture: customerData.prefecture,
        address: customerData.address,
        phoneNumber: customerData.phoneNumber,
        faxNumber: customerData.faxNumber,
        contactPerson: customerData.contactPerson,
        isActive: true,
        marginRate: customerData.marginRate,
      },
    });

    customerCount++;

    // 各納品先を作成
    for (const dlData of customerData.deliveryLocations) {
      const dlId = generateId();

      await prisma.deliveryLocation.create({
        data: {
          id: dlId,
          code: dlData.code,
          name: dlData.name,
          postalCode: dlData.postalCode,
          prefecture: dlData.prefecture,
          address: dlData.address,
          phoneNumber: dlData.phoneNumber,
          faxNumber: null,
          contactPerson: null,
          isActive: true,
          customerId: customerId,
          deliveryNotes: dlData.deliveryNotes,
        },
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
  // 見積は得意先・納品先・部署・従業員・商品を参照する（onDelete: Restrict）ため先に消す。
  await prisma.estimateVariationCopy.deleteMany();
  await prisma.estimateVariationRevision.deleteMany();
  await prisma.estimate.deleteMany();
  await prisma.taxRate.deleteMany();
  await prisma.setProductComponent.deleteMany();
  await prisma.productRelation.deleteMany();
  await prisma.product.deleteMany();
  await prisma.deliveryLocation.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.account.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.employeeRole.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.role.deleteMany();
  await prisma.position.deleteMany();
  await prisma.department.deleteMany();
  console.log("Deleted existing data");
  console.log("");

  // 部署を作成（cdで定義、idはシード時にCUID生成）
  console.log("Creating departments...");
  const departmentIdMap = new Map<string, string>(); // departmentCd → CUID
  for (const dept of DEPARTMENTS) {
    const id = generateId();
    departmentIdMap.set(dept.departmentCd, id);
    await prisma.department.create({
      data: {
        id,
        departmentCd: dept.departmentCd,
        name: dept.name,
        abbreviation: dept.abbreviation,
        isActive: true,
      },
    });
  }
  console.log(`Created ${DEPARTMENTS.length} departments`);
  console.log("");

  // 役職を作成（FK制約を考慮して上位から作成）
  console.log("Creating positions...");
  const positionIdMap = new Map<string, string>(); // cd → CUID
  const positionsOrdered = [...POSITIONS].reverse();
  for (const pos of positionsOrdered) {
    const id = generateId();
    positionIdMap.set(pos.cd, id);
    await prisma.position.create({
      data: {
        id,
        positionCd: pos.cd,
        name: pos.name,
        superiorPositionId: pos.superiorCd ? (positionIdMap.get(pos.superiorCd) ?? null) : null,
      },
    });
  }
  console.log(`Created ${POSITIONS.length} positions`);
  console.log("");

  // 役割を作成（定義順 = 上位から作成でFK制約を満たす）
  console.log("Creating roles...");
  const roleIdMap = new Map<string, string>(); // cd → CUID
  for (const role of ROLES) {
    const id = generateId();
    roleIdMap.set(role.cd, id);
    await prisma.role.create({
      data: {
        id,
        roleCd: role.cd,
        name: role.name,
        positionId: positionIdMap.get(role.positionCd)!,
        superiorRoleId: role.superiorCd ? (roleIdMap.get(role.superiorCd) ?? null) : null,
      },
    });
  }
  console.log(`Created ${ROLES.length} roles`);
  console.log("");

  // 商品を作成
  console.log("Creating products...");
  for (const product of PRODUCTS) {
    await prisma.product.create({
      data: {
        id: generateId(),
        code: product.code,
        name: product.name,
        category: product.category,
        unit: product.unit,
        costPrice: product.costPrice,
        isActive: product.isActive,
        description: product.description,
      },
    });
  }
  console.log(`Created ${PRODUCTS.length} products`);

  // セット構成（SetProductComponent・ADR-0047）。コード→id を解決して交差行を作る。
  const productsByCode = new Map(
    (await prisma.product.findMany({ select: { id: true, code: true } })).map((p) => [p.code, p.id])
  );
  await prisma.setProductComponent.createMany({
    data: SET_COMPONENTS.map((c) => ({
      setProductId: productsByCode.get(c.setCode)!,
      componentProductId: productsByCode.get(c.componentCode)!,
      quantity: c.quantity,
    })),
  });
  console.log(`Created ${SET_COMPONENTS.length} set product components`);
  console.log("");

  // 消費税率を作成（昇順で投入。前期間の終わり = 次の行の effectiveFrom の暗黙）
  console.log("Creating tax rates...");
  for (const tr of TAX_RATES) {
    await prisma.taxRate.create({
      data: { id: generateId(), rate: tr.rate, effectiveFrom: tr.effectiveFrom },
    });
  }
  console.log(`Created ${TAX_RATES.length} tax rates`);
  console.log("");

  // 得意先・納品先を作成
  const { customerCount, deliveryLocationCount } = await seedCustomersAndDeliveryLocations();

  // パスワードは全員同じなので、事前に1回だけハッシュ化
  console.log("Hashing password...");
  const hashedPassword = await hashPassword(DEFAULT_PASSWORD);
  console.log("Password hashed");
  console.log("");

  // ユーザーデータを生成
  const users = generateSeedUsers(TOTAL_EMPLOYEES, roleIdMap, departmentIdMap);
  let adminCount = 0;
  let userCount = 0;

  // 各ユーザーを作成（バッチごとに進捗表示）
  console.log("Creating users...");
  const startTime = Date.now();
  const employeeRoleData: { employeeId: string; roleId: string }[] = [];

  for (let i = 0; i < users.length; i++) {
    const userData = users[i];
    const { employee } = await createUserWithEmployee(userData, hashedPassword);

    // 役割を持つ従業員の場合、EmployeeRole 用のデータを収集
    if (userData.assignedRoleId) {
      employeeRoleData.push({ employeeId: employee.id, roleId: userData.assignedRoleId });
    }

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

  // 従業員役割を作成
  console.log("");
  console.log("Creating employee roles...");
  for (const data of employeeRoleData) {
    await prisma.employeeRole.create({ data });
  }
  console.log(`Created ${employeeRoleData.length} employee role assignments`);

  // 見積（#330 / S2 閲覧画面のデモ用）。マスタ作成後に参照して作る。
  const estimateCount = await seedEstimates(prisma);
  console.log(`Created ${estimateCount} estimates`);

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("");
  console.log("");
  console.log("=".repeat(50));
  console.log("Seeding finished.");
  console.log(`Total time: ${totalTime}s`);
  console.log(`Created ${TOTAL_EMPLOYEES} employees:`);
  console.log(`  - Admins: ${adminCount}`);
  console.log(`  - Users: ${userCount}`);
  console.log(`Created ${POSITIONS.length} positions`);
  console.log(`Created ${ROLES.length} roles`);
  console.log(`Created ${employeeRoleData.length} employee role assignments`);
  console.log(`Created ${PRODUCTS.length} products`);
  console.log(`Created ${TAX_RATES.length} tax rates`);
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
