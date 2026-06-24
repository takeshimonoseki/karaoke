(() => {
  "use strict";

  // カラオケでよく探される表記ゆれ（英語↔カナ↔略称）
  const GROUPS = [
    ["Ziggy", "ZIGGY", "ジギー", "じぎー", "ジギ"],
    ["BOYZ II MEN", "Boyz II Men", "ボーイズIIメン", "ボーイズツーメン", "boys ii men"],
    ["Coldplay", "コールドプレイ", "こーるどぷれい"],
    ["Queen", "クイーン", "くいーん"],
    ["The Beatles", "Beatles", "ビートルズ", "びーとるず"],
    ["Michael Jackson", "マイケルジャクソン", "マイケル・ジャクソン"],
    ["Ed Sheeran", "エドシーラン", "エド・シーラン"],
    ["Bruno Mars", "ブルーノマーズ", "ブルーノ・マーズ"],
    ["Maroon 5", "マルーン5", "マルーン・ファイブ"],
    ["OneRepublic", "ワンリパブリック", "わんりぱぶりっく"],
    ["GLORIA ESTEFAN", "Gloria Estefan", "グロリアエステファン", "グロリア・エステファン"],
    ["GLORIA ESTEFAN AND MIAMI SOUND MACHINE", "Miami Sound Machine", "マイアミサウンドマシーン"],
    ["LUNA SEA", "Luna Sea", "ルナシー", "るなしー"],
    ["DA PUMP", "Da Pump", "ダパンプ", "だぱんぷ"],
    ["Skid Row", "スキッドロウ", "すきっどろう"],
    ["MR. BIG", "Mr.Big", "Mr. Big", "ミスタービッグ"],
    ["Official髭男dism", "Official Hige Dandism", "髭男", "ひげだん", "ヒゲダン"],
    ["Mrs. GREEN APPLE", "Mrs GREEN APPLE", "ミセス", "みせす"],
    ["King Gnu", "キングヌー", "きんぐぬー"],
    ["back number", "バックナンバー", "ばっくなんばー"],
    ["米津玄師", "ヨネヅケンシ", "よねづけんし", "Kenshi Yonezu", "Yonezu"],
    ["Vaundy", "ヴォーディ", "ばうんでぃ", "ボーディ"],
    ["優里", "Yuuri", "ゆうり", "YURI"],
    ["あいみょん", "Aimyon", "アイミョン"],
    ["Ado", "アド", "あど"],
    ["YOASOBI", "ヨアソビ", "よあそび"],
    ["LiSA", "リサ", "りさ", "Lisa"],
    ["ONE OK ROCK", "OOR", "ワンオク", "わんおく"],
    ["B'z", "Bz", "ビーズ", "びーず"],
    ["サザンオールスターズ", "Southern All Stars", "サザン", "さざん"],
    ["スピッツ", "Spitz", "すぴっつ"],
    ["ポルノグラフィティ", "Porno Graffitti", "ポルノ", "ぽるの"],
    ["レミオロメン", "Remioromen", "れみおろめん"],
    ["ORANGE RANGE", "Orange Range", "オレンジレンジ", "おれんじれんじ"],
    ["RADWIMPS", "ラッドウィンプス", "らっどうぃんぷす"],
    ["サカナクション", "Sakanaction", "さかな"],
    ["SEKAI NO OWARI", "Sekai no Owari", "セカオワ", "せかおわ"],
    ["GReeeeN", "Greeeen", "グリーン", "ぐりーん"],
    ["AKB48", "エーケービー48", "えーけーびー"],
    ["乃木坂46", "ノギザカ", "のぎざか"],
    ["欅坂46", "Keyakizaka46", "ケヤキザカ"],
    ["櫻坂46", "Sakurazaka46", "サクラザカ"],
    ["50/50", "50-50", "フィフティフィフティ", "フィフティ", "fifty fifty", "フィフテイ"],
    ["GLAY", "グレイ", "ぐれい"],
    ["L'Arc-en-Ciel", "L Arc en Ciel", "L'Arc~en~Ciel", "ラルク", "らるく", "SHO", "HYDE"],
    ["X JAPAN", "XJapan", "エックスジャパン", "X"],
    ["DEEN", "ディーン", "でーん"],
    ["WANDS", "ワンズ", "わんず"],
    ["T-BOLAN", "T BOLAN", "ティーボラン", "てぃーぼらん"],
    ["TOM・CAT", "TOM CAT", "トムキャット"],
    ["ゴダイゴ", "Godiego", "ゴディゴ", "ごだいご"],
    ["FIELD OF VIEW", "フィールドオブビュー"],
    ["きただにひろし", "Kitadani Hiroshi", "北谷洋"],
    ["FLOW", "フロウ", "ふろう"],
    ["Creepy Nuts", "クリーピーナッツ", "くりーぴーなっつ"],
    ["Number_i", "Number i", "ナンバーアイ"],
    ["INI", "アイエヌアイ", "いえぬあい"],
    ["Snow Man", "スノーマン", "すのーまん"],
    ["SixTONES", "シックストーンズ", "すとーんず"],
    ["King & Prince", "キンプリ", "きんぷり"],
    ["なにわ男子", "Naniwa Danji"],
    ["TWICE", "トゥワイス", "とぅわいす"],
    ["BLACKPINK", "ブラックピンク", "ぶらっくぴんく"],
    ["NewJeans", "ニュージーンズ", "にゅーじーんず"],
    ["IVE", "アイヴ", "あいヴ"],
    ["宇多田ヒカル", "Hikaru Utada", "Utada", "うただ"],
    ["浜崎あゆみ", "Ayumi Hamasaki", "あゆ"],
    ["安室奈美恵", "Namie Amuro", "あむろ"],
    ["西野カナ", "Kana Nishino", "にしの"],
    ["aiko", "アイコ", "あいこ"],
    ["椎名林檎", "Sheena Ringo", "林檎"],
    ["藤井風", "Fujii Kaze", "ふじいかぜ"],
    ["星野源", "Gen Hoshino", "ほしの"],
    ["菅田将暉", "Masaki Suda", "すだ"],
    ["秦 基博", "秦基博", "Hata Motohiro", "はた"],
    ["福山雅治", "Masaharu Fukuyama", "ふくやま"],
    ["玉置浩二", "Koji Tamaki", "たまき"],
    ["長渕剛", "Tsuyoshi Nagabuchi", "ながぶち"],
    ["尾崎豊", "Yutaka Ozaki", "おざき"],
    ["谷村新司", "Shinji Tanimura", "たにむら"],
    ["BEGIN", "ビギン", "びぎん"],
    ["THE BOOM", "The Boom", "ザブーム"],
    ["MONGOL800", "モンゴル800", "もんごる"],
    ["HYDE", "ハイド", "はいど"],
    ["YOSHIKI", "ヨシキ", "よしき"],
    ["HISASHI", "ヒサシ", "ひさし"],

    // Western artists - modern era
    ["Taylor Swift", "テイラースウィフト", "テイラー・スウィフト", "テイラー"],
    ["Billie Eilish", "ビリーアイリッシュ", "ビリー・アイリッシュ", "びりーあいりっしゅ"],
    ["The Weeknd", "ザウィークエンド", "ウィークエンド", "weeknd"],
    ["Harry Styles", "ハリースタイルズ", "ハリー・スタイルズ"],
    ["Olivia Rodrigo", "オリビアロドリゴ", "オリビア・ロドリゴ"],
    ["Dua Lipa", "デュアリパ", "デュア・リパ"],
    ["Post Malone", "ポストマローン", "ぽすとまろーん"],
    ["Ariana Grande", "アリアナグランデ", "アリアナ・グランデ", "ありあな"],
    ["Justin Bieber", "ジャスティンビーバー", "ジャスティン・ビーバー"],
    ["Lady Gaga", "レディガガ", "レディー・ガガ", "らでぃがが"],
    ["Beyoncé", "Beyonce", "ビヨンセ", "びよんせ"],
    ["Eminem", "エミネム", "えみねむ"],
    ["Adele", "アデル", "あでる"],
    ["Linkin Park", "リンキンパーク", "Linkin' Park", "りんきんぱーく"],
    ["Bon Jovi", "ボンジョビ", "ぼんじょび"],
    ["Guns N' Roses", "Guns N Roses", "ガンズアンドローゼズ", "ガンズ"],
    ["Nirvana", "ニルヴァーナ", "ニルバーナ", "にるばーな"],
    ["Alanis Morissette", "アラニスモリセット", "アラニス・モリセット"],
    ["Whitney Houston", "ホイットニーヒューストン", "ホイットニー・ヒューストン"],
    ["Celine Dion", "セリーヌディオン", "セリーヌ・ディオン"],
    ["ABBA", "アバ", "あば"],
    ["Elvis Presley", "エルビスプレスリー", "エルビス・プレスリー", "えるびす"],
    ["Frank Sinatra", "フランクシナトラ", "フランク・シナトラ"],
    ["Carpenters", "カーペンターズ", "かーぺんたーず"],
    ["Elton John", "エルトンジョン", "エルトン・ジョン"],
    ["Eagles", "イーグルス", "いーぐるす"],
    ["Simon & Garfunkel", "Simon and Garfunkel", "サイモン&ガーファンクル", "サイモンとガーファンクル"],
    ["Billy Joel", "ビリージョエル", "ビリー・ジョエル"],
    ["Led Zeppelin", "レッドツェッペリン", "ツェッペリン"],
    ["The Human League", "Human League", "ヒューマンリーグ"],
    ["Wham!", "Wham", "ワム", "わむ"],
    ["George Michael", "ジョージマイケル", "ジョージ・マイケル"],
    ["Journey", "ジャーニー", "じゃーにー"],
    ["Backstreet Boys", "BSB", "バックストリートボーイズ"],
    ["NSYNC", "N SYNC", "エヌシンク", "んしんく"],
    ["Destiny's Child", "Destinys Child", "デスティニーズチャイルド"],
    ["Christina Aguilera", "クリスティーナアギレラ", "クリスティーナ・アギレラ"],
    ["Shania Twain", "シャナイアトゥエイン", "シャナイア・トゥエイン"],
    ["One Direction", "1D", "ワンダイレクション"],
    ["Katy Perry", "ケイティペリー", "ケイティ・ペリー"],
    ["Sam Smith", "サムスミス", "サム・スミス"],
    ["Imagine Dragons", "イマジンドラゴンズ", "いまじんどらごんず"],
    ["Mark Ronson", "マークロンソン", "マーク・ロンソン"],
    ["BLACKPINK", "ブラックピンク", "ぶらっくぴんく"],
    ["BTS", "防弾少年団", "ぼうだんしょうねんだん", "방탄소년단", "ビーティーエス"],
    ["TWICE", "トゥワイス", "とぅわいす"],
    ["NewJeans", "ニュージーンズ", "にゅーじーんず"],
    ["aespa", "エスパ", "えすぱ"],
    ["IVE", "アイヴ", "あいヴ"],
    ["ROSÉ", "Rose", "ロゼ", "ろぜ"],

    // J-pop artists with tricky names
    ["竹内まりや", "Mariya Takeuchi", "たけうちまりや"],
    ["松任谷由実", "荒井由実", "ユーミン", "ゆーみん", "Yumi Matsutoya", "Yumi Arai", "Yuming"],
    ["大瀧詠一", "大滝詠一", "Eiichi Ohtaki", "おおたきえいいち"],
    ["角松敏生", "かどまつとしき", "Toshiki Kadomatsu"],
    ["杉山清貴", "すぎやまきよたか"],
    ["細川たかし", "ほそかわたかし"],
    ["北島三郎", "きたじまさぶろう", "サブちゃん"],
    ["八代亜紀", "やしろあき"],
    ["五木ひろし", "いつきひろし"],
    ["美空ひばり", "みそらひばり", "Hibari Misora"],
    ["都はるみ", "みやこはるみ"],
    ["千昌夫", "せんまさお"],
    ["小林旭", "こばやしあきら"],
    ["吉幾三", "よしいくぞう"],
    ["田原俊彦", "たはらとしひこ", "トシちゃん"],
    ["近藤真彦", "こんどうまさひこ", "マッチ"],
    ["松田聖子", "まつだせいこ", "Seiko Matsuda"],
    ["中森明菜", "なかもりあきな", "Akina Nakamori"],
    ["テレサ・テン", "テレサテン", "Teresa Teng", "鄧麗君", "てれさてん"],
    ["中島みゆき", "なかじまみゆき", "Miyuki Nakajima"],
    ["かぐや姫", "かぐやひめ", "Kaguyahime"],
    ["荒井由実", "あらいゆみ"],
    ["オフコース", "off course", "Off Course", "おふこーす"],
    ["赤い鳥", "あかいとり"],
    ["太田裕美", "おおたひろみ"],
    ["海援隊", "かいえんたい"],
    ["イルカ", "いるか"],
    ["谷村新司", "たにむらしんじ"],
    ["沢田研二", "さわだけんじ", "ジュリー"],
    ["西城秀樹", "さいじょうひでき"],
    ["寺尾聰", "てらおあきら"],
    ["長渕剛", "ながぶちつよし"],
    ["尾崎豊", "おざきゆたか"],
    ["松山千春", "まつやまちはる"],
    ["久保田早紀", "くぼたさき"],
    ["クリスタルキング", "Crystal King", "くりすたるきんぐ"],
    ["井上陽水", "いのうえようすい"],
    ["山下達郎", "やましたたつろう", "Tatsuro Yamashita"],
    ["山口百恵", "やまぐちももえ"],
    ["DREAMS COME TRUE", "ドリカム", "どりかむ", "Dreams Come True"],
    ["ゴダイゴ", "Godiego", "ごだいご"],
    ["THE BLUE HEARTS", "The Blue Hearts", "ブルーハーツ", "ぶるーはーつ"],
    ["レベッカ", "Rebecca", "れべっか"],
    ["渡辺美里", "わたなべみさと"],
    ["槇原敬之", "まきはらのりゆき", "Noriyuki Makihara"],
    ["小田和正", "おだかずまさ", "Kazumasa Oda"],
    ["米米CLUB", "KOME KOME CLUB", "こめこめくらぶ"],
    ["KAN", "かん"],
    ["ZARD", "ざーど"],
    ["中山美穂", "なかやまみほ"],
    ["チェッカーズ", "The Checkers", "ちぇっかーず"],
    ["安全地帯", "あんぜんちたい"],

    // Song title aliases
    ["いい日旅立ち", "いいひたびだち", "良い日旅立ち"],
    ["糸", "中島みゆきの糸"],
    ["翼をください", "つばさをください", "翼を下さい"],
    ["川の流れのように", "かわのながれのように"],
    ["時の流れに身をまかせ", "ときのながれにみをまかせ"],
    ["木綿のハンカチーフ", "もめんのはんかちーふ"],
    ["なごり雪", "なごりゆき"],
    ["また逢う日まで", "またあうひまで"],
    ["贈る言葉", "おくることば"],
    ["津軽海峡・冬景色", "つがるかいきょうふゆげしき", "津軽海峡冬景色"],
    ["天城越え", "あまぎごえ"],
    ["矢切の渡し", "やぎりのわたし"],
    ["北の宿から", "きたのやどから"],
    ["Plastic Love", "プラスティックラブ", "プラスティック・ラブ"],
    ["Dancing Queen", "ダンシングクイーン", "だんしんぐくいーん"],
    ["Bohemian Rhapsody", "ボヘミアンラプソディ", "ぼへみあん"],
    ["Hotel California", "ホテルカリフォルニア", "ほてるかりふぉるにあ"],
    ["Blinding Lights", "ブラインディングライツ"],
    ["Shape of You", "シェイプオブユー"],
    ["Rolling in the Deep", "ローリングインザディープ"],
    ["Dynamite", "ダイナマイト", "BTS Dynamite"]
  ];

  function kanaToHiragana(value) {
    return String(value || "").replace(/[\u30a1-\u30f6]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0x60));
  }

  function normalizeSearchToken(value) {
    return kanaToHiragana(String(value || "").normalize("NFKC"))
      .toLowerCase()
      .replace(/[\s\u3000._\-–—'’"`´&／/\\()+（）[\]【】]/g, "")
      .replace(/[・･]/g, "");
  }

  function expandSearchQueryVariants(query) {
    const raw = String(query || "").trim();
    if (!raw) return [];

    const base = normalizeSearchToken(raw);
    const variants = new Set([raw]);
    if (!base) return [raw];

    GROUPS.forEach((group) => {
      const tokens = group.map(normalizeSearchToken).filter(Boolean);
      const hit = tokens.some((token) =>
        token === base ||
        token.includes(base) ||
        base.includes(token) ||
        (base.length >= 2 && token.startsWith(base))
      );
      if (hit) group.forEach((name) => variants.add(name));
    });

    return [...variants].filter(Boolean).slice(0, 10);
  }

  window.UtaNoteSearchAliases = {
    expandSearchQueryVariants,
    normalizeSearchToken
  };
})();
