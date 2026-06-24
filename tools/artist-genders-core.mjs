/** Node/browser shared artist gender resolver (source of truth for build tools) */

import { BULK_FEMALE, BULK_MALE, BULK_MIXED } from "./gender-hints-bulk.mjs";
import { AUTO_FEMALE, AUTO_MALE, AUTO_MIXED } from "./gender-hints-auto.mjs";

const FEMALE_HINTS = [
  "Ado", "LiSA", "YOASOBI", "あいみょん", "aiko", "MISIA", "宇多田ヒカル", "浜崎あゆみ",
  "安室奈美恵", "西野カナ", "椎名林檎", "中島みゆき", "一青窈", "岡本真夜", "高橋洋子",
  "Adele", "Lady Gaga", "Whitney Houston", "Celine Dion", "Taylor Swift", "Billie Eilish", "ROSÉ",
  "TWICE", "IVE", "BLACKPINK", "LE SSERAFIM", "NewJeans", "aespa", "ITZY", "NMIXX",
  "大塚愛", "Perfume", "AKB48", "乃木坂46", "櫻坂46", "日向坂46", "羊文学", "しぐれうい",
  "絢香", "milet", "倉木麻衣", "中島美嘉", "倖田來未", "Superfly", "幾田りら", "上白石萌音",
  "NiziU", "BABYMONSTER", "STAYC", "Red Velvet", "(G)I-DLE", "XG", "FRUITS ZIPPER",
  "いきものがかり", "緑黄色社会", "手嶌葵", "石川さゆり", "ちゃんみな", "岩崎良美", "AI",
  "半崎美子", "小林明子", "堀江美都子", "宇野ゆう子", "大山のぶ代", "夏川りみ",
  "松田聖子", "中森明菜", "山口百恵", "渡辺美里", "レベッカ", "かぐや姫", "イルカ",
  "久保田早紀", "太田裕美", "美波", "美空ひばり", "涼宮ハルヒの憂鬱", "mao",
  "Beyoncé", "Beyonce", "Rihanna", "Ariana Grande", "Sheryl Crow", "Mariah Carey",
  "Madonna", "Shakira", "Katy Perry", "Miley Cyrus", "Dua Lipa", "Sia", "P!nk",
  "秋吉美紗", "三重野瞳", "テレサ・テン", "八神純子", "森高千里", "小泉今日子",
  "工藤静香", "Wink", "PRINCESS PRINCESS", "ZARD", "Every Little Thing", "SPEED",
  "水樹奈々", "愛内里菜", "明透", "LINDSAY LOHAN", "松任谷由実", "浜田麻里", "globe",
  "林原めぐみ", "谷村有美", "坂本冬美", "川中美幸", "May'n", "Sowelu", "松浦亜弥",
  "島谷ひとみ", "少女時代", "MAX", "奥井雅美", "倉木麻衣", "安室奈美恵", "hitomi",
  "HITOMI", "倖田來未", "Every Little Thing", "SPEED",
  "Wink", "PRINCESS PRINCESS", "ZARD", "小柳ゆき", "中島美雪", "吉田美和", "持田香織",
  "広瀬香美", "中山美穂", "大黒摩季", "永井真理子", "青山テルマ", "板野友美", "今井美樹",
  "華原朋美", "CHARA", "相川七瀬", "吉川友", "吉川 友", "girl next door", "山下久美子",
  "ももいろクローバーZ", "叶", "JUJU", "Britney Spears", "S.E.S.", "TRF", "GARNET CROW",
  "KOTOKO", "Poppin'Party", "伍代夏子", "平松愛理", "アン・ルイス", "MANISH", "Cyndi Lauper",
  "CYNDI LAUPER",   "FANATIC◇CRISIS", "SOPHIA", "BoA", "YUI", "鈴木あみ", "加藤ミリヤ", "Fayray",
  "三枝夕夏", "岡村孝子", "森川美穂", "ExWHYZ", "FAKY", "≠ME", "アンジュルム",
  "ティーナ・カリーナ", "My Little Lover", "CHOOZEN LEE", "ChoZEN LEE",
  ...BULK_FEMALE,
  ...AUTO_FEMALE
];

const MALE_HINTS = [
  "Mrs. GREEN APPLE", "優里", "Creepy Nuts", "米津玄師", "Official髭男dism", "髭男",
  "back number", "Vaundy", "King Gnu", "B'z", "スピッツ", "ポルノグラフィティ",
  "サザンオールスターズ", "SMAP", "WANDS", "FIELD OF VIEW", "レミオロメン",
  "スキマスイッチ", "MONGOL800", "尾崎豊", "玉置浩二", "斉藤和義", "福山雅治",
  "The Beatles", "Queen", "Eagles", "Michael Jackson", "Ed Sheeran", "Bruno Mars",
  "Coldplay", "Maroon 5", "OneRepublic", "DEEN", "ONE OK ROCK", "BUMP OF CHICKEN",
  "Mr.Big", "L'Arc", "GLAY", "サカナクション", "藤井風", "RADWIMPS",
  "MAN WITH A MISSION", "UVERworld", "ORANGE RANGE", "T-BOLAN", "TOM・CAT",
  "Creepy Nuts", "Number_i", "INI", "BE:FIRST", "Snow Man", "SixTONES", "King & Prince",
  "GENERATIONS", "EXILE", "清水翔太", "三浦大知", "星野源", "秦 基博", "平井堅",
  "BOØWY", "長渕剛", "谷村新司", "井上陽水", "Eve", "菅田将暉", "瑛人",
  "ゴダイゴ", "ささきいさお", "大野雄二", "山下毅雄", "炭竈瓢太郎", "水木一郎",
  "きただにひろし", "Kitadani Hiroshi", "北谷洋", "Ziggy", "ZIGGY", "ジギー",
  "吉幾三", "沢田研二", "尾崎紀世彦", "寺尾聰", "西城秀樹", "山下達郎",
  "クリスタルキング", "チェッカーズ", "THE BLUE HEARTS", "海援隊", "笠井晶水",
  "なみだぐま", "TK from", "Godiego", "tuki.", "Omoinotake", "Skid Row",
  "影山ヒロノブ", "山川豊", "串田アキラ", "都倉俊文", "藤倉大",
  "シブキ・トシオ", "タケカワユキヒデ", "Phil Collins", "Sting", "Elvis Presley",
  "John Lennon", "Mark Ronson", "Imagine Dragons", "T.M.Revolution", "布袋寅泰",
  "槇原敬之", "徳永英明", "稲垣潤一", "安全地帯", "CHAGE and ASKA", "ORIGINAL LOVE",
  "松山千春", "吉田拓郎", "忌野清志郎", "RCサクセション", "サンボマスター",
    "氷川きよし", "KinKi Kids", "Hey! Say! JUMP", "LUNA SEA", "Mr.Children", "舞祭組",
    "The Brow Beat", "山下智久", "KoЯn", "河村隆一", "ジャニーズWEST", "福田こうへい",
    "香取慎吾", "TUBE", "超特急", "w-inds.", "Kis-My-Ft2", "木村拓哉", "TOKIO", "V6",
    "KinKi Kids", "関ジャニ∞", "NEWS", "KAT-TUN", "嵐", "CHEMISTRY", "Dragon Ash",
    "GLAY", "L'Arc〜en〜Ciel", "X JAPAN", "BUCK-TICK", "Dir en grey", "L'Arc-en-Ciel",
  "Left Alone", "Toi Toi Toi", "久保田利伸", "ケツメイシ", "FUNKY MONKEY BABYS",
  "三山ひろし", "Sexy Zone", "ゴールデンボンバー", "三代目 J Soul Brothers", "BREAKERZ",
  "CORN HEAD", "access", "氷室京介", "Da-iCE", "辰巳ゆうと", "10-FEET", "KIX・S",
  "WHITESNAKE", "YNGWIE MALMSTEEN", "KAT-TUN", "関ジャニ", "なにわ男子", "Travis Japan",
  "timelesz", "FUNKY MONKEY BABYS", "湘南乃風", "ORANGE RANGE", "175R", "HYDE",
  "L'Arc-en-Ciel", "GLAY", "B'z", "UVERworld", "MAN WITH A MISSION", "Alexandros",
  "[Alexandros]", "THE YELLOW MONKEY", "SPitz", "SPITZ", "ゆず", "コブクロ", "GReeeeN",
  "サザンオールスターズ", "CHAGE and ASKA", "TM NETWORK", "TMN", "REBECCA", "BOØWY",
  "COMPLEX", "KATSUMI", "KAN", "TUBE", "RCサクセション",
  "flumpool", "Elvis Costello", "矢沢永吉", "L⇔R", "L⇔R(エルアール)", "THE KBC",
  "Kroi", "光GENJI", "シャ乱Q", "鳥羽一郎", "ZORN", "米米CLUB", "oasis", "Oasis",
  "ドン・マツオ", "JAM Project", "Green Day", "THE ALFEE", "DAVID BOWIE", "SHAKALABBITS",
  "THE OFFSPRING", "H.O.T.", "Die In Cries", "吉川晃司", "シブがき隊", "FLOW", "The Gospellers",
  "東方神起", "RIP SLYME", "とんねるず", "the pillows", "PENICILLIN", "SLIPKNOT",
  "Iceman", "SING LIKE TALKING", "スケボーキング", "LinDberg", "LINDBERG", "純烈", "いれいす",
  "赤西仁", "宇都宮隆", "ALI", "OZROSAURUS", "JAYWALK", "Skoop On Somebody", "DABO",
  "ANDY WILLIAMS", "the band apart", "韓国童謡", "チョソンモ", "金ちゃん", "らっぷびと",
  "ドンリージュン", "オムジョンファ", "mill nuts", "OPERA", "CLASSIC",
  "vistlip", "Base Ball Bear", "SADS", "ANTHEM", "SEX MACHINEGUNS", "Toshl",
  "LINKIN PARK", "BACK-ON", "東野純直", "LA-PPISCH", "佐野元春", "桑田佳祐",
  "細川たかし", "松原健之", "一条貫太", "手越祐也", "OCTPATH", "Knight A",
  "唾奇", "TOOBOE", "DECO*27", "SHAZNA", "EL-MALO", "So'Fly", "0 SOUL 7",
  "コタニキンヤ", "ZI÷KILL", "Skid Row",
  ...BULK_MALE,
  ...AUTO_MALE
];

const MIXED_HINTS = [
  "DREAMS COME TRUE", "WhiteFlame", "初音ミク", "鏡音リン", "鏡音レン", "ボーカロイド",
  "Lady Gaga & Bradley Cooper", "Lady Gaga & Bruno Mars", "ROSÉ & Bruno Mars",
  "Mark Ronson ft. Bruno Mars", "シブキ・トシオ/タケカワユキヒデ",
  "angela", "moumoon", "m.o.v.e", "DOUBLE", "SMAP", "神聖かまってちゃん", "My Little Lover",
  ...BULK_MIXED,
  ...AUTO_MIXED
];

const EXPLICIT_MAP = {
  smap: "mixed",
  "dreams come true": "mixed",
  "whiteflame feat.初音ミク": "mixed",
  "みきとp feat.鏡音リン": "mixed"
};

export function normalizeArtistKey(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("ja")
    .replace(/\s+/g, " ")
    .trim();
}

function buildGenderMap() {
  const map = { ...EXPLICIT_MAP };
  FEMALE_HINTS.forEach((hint) => {
    map[normalizeArtistKey(hint)] = "female";
  });
  MALE_HINTS.forEach((hint) => {
    const key = normalizeArtistKey(hint);
    if (!map[key]) map[key] = "male";
  });
  MIXED_HINTS.forEach((hint) => {
    map[normalizeArtistKey(hint)] = "mixed";
  });
  return map;
}

const ARTIST_GENDERS = buildGenderMap();

export function resolveArtistGender(artist) {
  const raw = String(artist || "").trim();
  if (!raw) return "unknown";

  const key = normalizeArtistKey(raw);
  if (ARTIST_GENDERS[key]) return ARTIST_GENDERS[key];

  for (const [hint, gender] of Object.entries(ARTIST_GENDERS)) {
    if (key.includes(hint) || hint.includes(key)) return gender;
  }

  if (/feat\.|featuring|&|×|✕|with/i.test(raw)) return "mixed";
  if (/初音ミク|鏡音リン|鏡音レン|ボーカロイド|vocaloid/i.test(raw)) return "mixed";
  if (/cv[.:：]|（cv|一同|合唱/i.test(raw)) return "mixed";
  if (/^(ive|itzy|twice|aespa|nmixx|blackpink)$/i.test(raw)) return "female";
  if (/AKB48|乃木坂|櫻坂|日向坂|モーニング娘|℃-ute|NMB48|SKE48|HKT48|Berryz|Buono!|PASSOLOG/i.test(raw)) {
    return "female";
  }
  if (/ジャニーズ|KAT-TUN|Sexy Zone|King & Prince|SixTONES|Snow Man|BE:FIRST|なにわ男子|timelesz|Travis Japan|関ジャニ|Hey! Say! JUMP|Kis-My-Ft2|ジャニーズWEST|TOKIO|V6|KinKi|嵐|NEWS|少年隊|STARTO/i.test(raw)) {
    return "male";
  }
  if (/EXILE|三代目|GENERATIONS|THE RAMPAGE|FANTASTICS|BALLISTIK BOYZ|PSYCHIC FEVER/i.test(raw)) {
    return "male";
  }
  if (/光GENJI|少年隊|シブがき隊|チェッカーズ|男闘呼|男闘呼組|TIM|ZOO|ZOO$/i.test(raw)) {
    return "male";
  }
  if (/GARNET CROW|Every Little Thing|SPEED|MAX|Wink|ZARD|TRF|S\.E\.S\.|≠ME|=LOVE|ももいろ/i.test(raw)) {
    return "female";
  }
  if (/SUPER JUNIOR|BOYS AND MEN|VISUAL KEi|V系|メタル/i.test(raw)) return "male";
  if (/^(AC\/DC|T\.Rex|Oasis|Queen|Eagles|Metallica|Nirvana|Guns N|Blur|Boston|Sum 41|SUM41|Westlife|westlife)/i.test(raw)) return "male";
  if (/北島|五木|細川|森進|坂本冬美|都はるみ|八代|美空/i.test(raw)) {
    return /北島|五木|細川|森進/.test(raw) ? "male" : "female";
  }
  if (/にじさんじ|ホロライブ|VTuber|星街|宝塚/i.test(raw)) return "mixed";
  if (/すとぷり|Stray Kids|ENHYPEN|TREASURE|BOYS/i.test(raw)) return "male";
  if (/家入レオ|阿部真央|藍井エイル|香西|星街|でんぱ/i.test(raw)) return "female";

  return "unknown";
}

export { ARTIST_GENDERS, FEMALE_HINTS, MALE_HINTS, MIXED_HINTS };
