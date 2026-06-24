(() => {
  "use strict";

  const L = window.UtaNoteLabels;
  const S = window.UtaNoteStorage;
  const LIST_LABELS = L.LIST_LABELS;

  const $ = (id) => document.getElementById(id);
  const els = {
    songList: $("songList"),
    songCount: $("songCount"),
    tabCanSing: $("tabCanSing"),
    tabCannotSing: $("tabCannotSing"),
    search: $("searchInput"),
    clearSearch: $("clearSearchButton"),
    sort: $("sortSelect"),
    reorder: $("reorderButton"),
    reorderHint: $("reorderHint"),
    random: $("randomButton"),
    emptyState: $("emptyState"),
    emptyMessage: $("emptyMessage"),
    openSearchFromEmpty: $("openSearchFromEmptyButton"),
    editDialog: $("editDialog"),
    form: $("songForm"),
    dialogTitle: $("dialogTitle"),
    songId: $("songId"),
    readonlyTitle: $("readonlyTitle"),
    readonlyArtist: $("readonlyArtist"),
    listType: $("listTypeInput"),
    key: $("keyInput"),
    tag: $("tagInput"),
    memo: $("memoInput"),
    singStats: $("singStats"),
    singStatsSummary: $("singStatsSummary"),
    singHistoryList: $("singHistoryList"),
    favorite: $("favoriteInput"),
    moveToCanSing: $("moveToCanSingButton"),
    delete: $("deleteButton"),
    cancel: $("cancelButton"),
    closeDialog: $("closeDialogButton"),
    menuButton: $("menuButton"),
    menuDialog: $("menuDialog"),
    closeMenu: $("closeMenuButton"),
    export: $("exportButton"),
    import: $("importButton"),
    importFile: $("importFile"),
    restoreAutoBackup: $("restoreAutoBackupButton"),
    autoBackupStatus: $("autoBackupStatus"),
    appVersionNote: $("appVersionNote"),
    toast: $("toast"),
    openSearch: $("openSearchButton"),
    searchDialog: $("searchDialog"),
    searchDialogInner: $("searchDialogInner"),
    globalSearch: $("globalSearchInput"),
    globalSearchStatus: $("globalSearchStatus"),
    globalSearchResults: $("globalSearchResults"),
    loadMoreBrowse: $("loadMoreBrowseButton"),
    closeSearch: $("closeSearchButton"),
    addTargetCanSing: $("addTargetCanSing"),
    addTargetCannotSing: $("addTargetCannotSing"),
    browseFilterPanel: $("browseFilterPanel"),
    browseAgeFilterRow: $("browseAgeFilterRow"),
    browseAgeNav: $("browseAgeNav"),
    browseGenreNav: $("browseGenreNav"),
    keywordSearchWrap: $("keywordSearchWrap"),
    searchSuggestions: $("searchSuggestions"),
    browseSortBar: $("browseSortBar"),
    browseSortSelect: $("browseSortSelect"),
    browseModeButtons: document.querySelectorAll(".browse-mode-button"),
    searchGenderAll: $("searchGenderAll"),
    searchGenderMale: $("searchGenderMale"),
    searchGenderFemale: $("searchGenderFemale"),
    recoveryBanner: $("recoveryBanner"),
    recoveryImportButton: $("recoveryImportButton"),
    loadSampleButton: $("loadSampleButton"),
    keyPickerButtons: $("keyPickerButtons")
  };

  let songs = S.loadSongs();
  let settings = S.loadSettings();
  let reorderMode = false;
  let toastTimer = null;
  let globalSearchTimer = null;
  let globalSearchRequestId = 0;
  let lastBrowseMeta = { offline: false, curatedOnly: false, localSearch: false };
  let highlightSongId = null;
  let highlightTimer = null;
  function isAppOnline() {
    return navigator.onLine !== false;
  }

  function normalizeSearchToken(value) {
    if (window.UtaNoteSearchAliases?.normalizeSearchToken) {
      return window.UtaNoteSearchAliases.normalizeSearchToken(value);
    }
    return normalizeText(value);
  }

  function expandSearchQueryVariants(query) {
    if (window.UtaNoteSearchAliases?.expandSearchQueryVariants) {
      return window.UtaNoteSearchAliases.expandSearchQueryVariants(query);
    }
    const raw = String(query || "").trim();
    return raw ? [raw] : [];
  }

  function searchLocalRegisteredSongs(query) {
    const variants = expandSearchQueryVariants(query);
    if (!variants.length) return [];

    return songs
      .filter((song) => matchesKeywordQuery(song, query))
      .map((song, index) => ({
        title: song.title,
        artist: song.artist,
        popularity: 200 - index,
        source: "local"
      }));
  }

  function itemSearchHaystack(item) {
    return `${normalizeSearchToken(item.title)}|${normalizeSearchToken(item.artist)}`;
  }

  function matchesKeywordQuery(item, query) {
    const variants = expandSearchQueryVariants(query);
    if (!variants.length) return false;
    const haystack = itemSearchHaystack(item);
    return variants.some((variant) => haystack.includes(normalizeSearchToken(variant)));
  }

  function scoreKeywordMatch(item, query) {
    const variants = expandSearchQueryVariants(query);
    let best = 0;
    const title = normalizeSearchToken(item.title);
    const artist = normalizeSearchToken(item.artist);

    variants.forEach((variant) => {
      const q = normalizeSearchToken(variant);
      if (!q) return;
      if (artist === q) best = Math.max(best, 3000);
      else if (title === q) best = Math.max(best, 2800);
      else if (artist.startsWith(q)) best = Math.max(best, 2400);
      else if (artist.includes(q)) best = Math.max(best, 2000);
      else if (title.includes(q)) best = Math.max(best, 1600);
    });

    return best;
  }

  function sortKeywordResults(results, query) {
    return [...results].sort((a, b) =>
      scoreKeywordMatch(b, query) - scoreKeywordMatch(a, query) ||
      (b.popularity || 0) - (a.popularity || 0) ||
      normalizeText(a.title).localeCompare(normalizeText(b.title), "ja")
    );
  }

  function normalizeArtistSearchKey(artist) {
    const token = normalizeSearchToken(artist);
    if (!token) return "";
    if (token === "ziggy" || token.startsWith("ジギ") || token.startsWith("じぎ")) return "ziggy";
    return token;
  }

  function dedupeKeywordResults(results) {
    const seen = new Set();
    return results.filter((item) => {
      const key = `${normalizeText(item.title)}|${normalizeArtistSearchKey(item.artist)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const BROWSE_INITIAL_COUNT = 50;
  const BROWSE_PAGE_STEP = 50;
  const KEYWORD_ARTIST_LIMIT = 500;
  const KEYWORD_DEFAULT_LIMIT = 200;

  function prioritizeKeywordResults(results, limit = KEYWORD_DEFAULT_LIMIT) {
    const master = [];
    const others = [];
    results.forEach((item) => {
      if (item.source === "master") master.push(item);
      else others.push(item);
    });
    return dedupeKeywordResults([...master, ...others]).slice(0, limit);
  }

  function applyBrowseGenreFilter(results) {
    if (browseGenre === "total") return results.map(enrichRankingItem);
    return results
      .map(enrichRankingItem)
      .filter((item) => matchesRankingGenre(item, browseGenre));
  }

  const GENRE_FILTER_OPTIONS = [
    { id: "total", label: "総合" },
    { id: "jpop-rock", label: "J-POP/ロック" },
    { id: "anime", label: "アニメ" },
    { id: "ballad", label: "バラード" },
    { id: "western", label: "その他（洋楽）" }
  ];


  const KNOWN_RELEASE_YEAR_ENTRIES = [
    ["残酷な天使のテーゼ", "高橋洋子", 1995],
    ["サウダージ", "ポルノグラフィティ", 1999],
    ["世界に一つだけの花", "SMAP", 2003],
    ["チェリー", "スピッツ", 1996],
    ["ロビンソン", "スピッツ", 2002],
    ["小さな恋のうた", "MONGOL800", 2004],
    ["粉雪", "レミオロメン", 2007],
    ["3月9日", "レミオロメン", 2008],
    ["TSUNAMI", "サザンオールスターズ", 2000],
    ["真夏の果実", "サザンオールスターズ", 1994],
    ["Pretender", "Official髭男dism", 2019],
    ["Lemon", "米津玄師", 2018],
    ["紅蓮華", "LiSA", 2019],
    ["怪獣の花唄", "Vaundy", 2020],
    ["ライラック", "Mrs. GREEN APPLE", 2024],
    ["ドライフラワー", "優里", 2020],
    ["夜に駆ける", "YOASOBI", 2019],
    ["うっせぇわ", "Ado", 2020],
    ["丸の内サディスティック", "椎名林檎", 2000],
    ["KICK BACK", "米津玄師", 2022],
    ["廻廻奇譚", "King Gnu", 2020],
    ["ピースサイン", "米津玄師", 2017],
    ["前前前世", "RADWIMPS", 2016],
    ["インフェルノ", "Mrs. GREEN APPLE", 2019],
    ["紅蓮華", "LiSA", 2019],
    ["DAN DAN 心魅かれてく", "FIELD OF VIEW", 1996],
    ["We Are!", "きただにひろし", 2000],
    ["銀河鉄道999", "ゴダイゴ", 1979],
    ["宇宙戦艦ヤマト", "ささきいさお", 1974],
    ["シュガーソングとビターステップ", "UNISON SQUARE GARDEN", 2014],
    ["青のすみか", "Vaundy", 2023],
    ["アイドル", "YOASOBI", 2023],
    ["残響散歌", "Aimer", 2021]
  ];

  const ROCK_ARTIST_HINTS = [
    "B'z", "GLAY", "L'Arc", "ONE OK ROCK", "BUMP OF CHICKEN", "スピッツ", "RADWIMPS",
    "UVERworld", "ORANGE RANGE", "BOØWY", "サザンオールスターズ", "ポルノグラフィティ",
    "King Gnu", "Official髭男dism", "Mrs. GREEN APPLE", "Vaundy", "MAN WITH A MISSION",
    "Creepy Nuts", "SEKAI NO OWARI", "サカナクション", "X JAPAN", "LUNA SEA"
  ];

  const ANIME_ARTIST_HINTS = [
    "LiSA", "Aimer", "高橋洋子", "ReoNa", "Eve", "美波", "ClariS", "fhána", "LiSA",
    "Vaundy", "UNISON SQUARE GARDEN", "TK from 凛として時雨", "WhiteFlame", "みきとP"
  ];

  const JAPANESE_LATIN_ARTIST_HINTS = [
    "SMAP", "NEWS", "GReeeeN", "MONGOL800", "AI", "KinKi", "HY", "WANDS", "BEGIN",
    "aiko", "SKYHI", "Da-iCE", "AKASAKI", "MISIA", "FRUITS ZIPPER", "Kanaria",
    "CUTIE STREET", "Omoinotake", "tuki.", "Saucy Dog", "DECO", "AKASAKI", "the FIELD OF VIEW",
    "WhiteFlame", "DISH", "ROSE", "Creepy Nuts", "Official", "Mrs.", "back number"
  ];

  const ANIME_SHOW_RULES = [
    { title: "残酷な天使", show: "新世紀エヴァンゲリオン" },
    { title: "紅蓮華", show: "鬼滅の刃" },
    { title: "残響散歌", show: "鬼滅の刃" },
    { title: "炎", artist: "LiSA", show: "鬼滅の刃" },
    { title: "アイドル", artist: "YOASOBI", show: "【推しの子】" },
    { title: "夜に駆ける", artist: "YOASOBI", show: "【推しの子】（劇場版）" },
    { title: "インフェルノ", show: "炎炎ノ消防隊" },
    { title: "DAN DAN", show: "ドラゴンボールGT" },
    { title: "ドラえもん", show: "ドラえもん" },
    { title: "ONE PIECE", show: "ONE PIECE" },
    { title: "私は最強", show: "ONE PIECE FILM RED" },
    { title: "ギラギラ", artist: "Ado", show: "【推しの子】" },
    { title: "うっせぇわ", artist: "Ado", show: "【推しの子】" },
    { title: "千本桜", show: "初音ミク（ボーカロイド）" },
    { title: "シュガーソング", show: "血界戦線" },
    { title: "KICK BACK", artist: "米津玄師", show: "チェンソーマン" },
    { title: "ピースサイン", artist: "米津玄師", show: "僕のヒーローアカデミア" },
    { title: "廻廻奇譚", show: "呪術廻戦" },
    { title: "カワキヲアメク", show: "東京リベンジャーズ" },
    { title: "鬼ノ宴", show: "鬼滅の刃" },
    { title: "新時代", artist: "Ado", show: "ONE PIECE FILM RED" },
    { title: "オトノケ", show: "ダンダダン" },
    { title: "Bling-Bang-Bang-Born", show: "マッシュル" },
    { title: "モニタリング", show: "ボーカロイド" },
    { title: "少女レイ", show: "ボーカロイド" },
    { title: "テトリス", show: "ボーカロイド" },
    { title: "unravel", show: "東京喰種トーキョーグール" },
    { title: "God knows", show: "涼宮ハルヒの憂鬱" },
    { title: "青のすみか", show: "呪術廻戦" },
    { title: "夢をかなえて", show: "ドラえもん" },
    { title: "銀河鉄道999", show: "銀河鉄道999" },
    { title: "前前前世", show: "君の名は。" },
    { title: "We Are", show: "ONE PIECE" },
    { title: "サザエさん", show: "サザエさん" },
    { title: "宇宙戦艦ヤマト", show: "宇宙戦艦ヤマト" },
    { title: "ルパン三世", show: "ルパン三世" },
    { title: "キューティーハニー", show: "キューティーハニー" },
    { title: "キャンディ", show: "キャンディ・キャンディ" },
    { title: "タッチ", show: "タッチ" },
    { title: "愛おぼえていますか", show: "超時空要塞マクロス" },
    { title: "タイムボカン", show: "タイムボカン" },
    { title: "あしたのジョー", show: "あしたのジョー" },
    { title: "ドラえもんのうた", show: "ドラえもん" },
    { title: "サウンダー", artist: "優里", show: "ドラマ『私の夫と結婚して』" }
  ];

  const ANIME_TITLE_HINTS = [
    "テーゼ", "紅蓮華", "残響散歌", "KICK BACK", "ピースサイン", "廻廻奇譚",
    "カワキヲアメク", "アイドル", "新時代", "鬼ノ宴", "unravel", "God knows",
    "インフェルノ", "DAN DAN", "ドラえもん", "ONE PIECE", "私は最強", "ギラギラ",
    "千本桜", "シュガーソング", "オトノケ", "Bling-Bang-Bang-Born", "モニタリング",
    "少女レイ", "テトリス", "青のすみか", "うっせぇわ"
  ];

  const BALLAD_TITLE_HINTS = [
    "ドライフラワー", "水平線", "マリーゴールド", "Subtitle", "高嶺の花子さん",
    "奏", "さよならエレジー", "香水", "花束", "瞳をとじて", "世界に一つだけの花",
    "粉雪", "3月9日", "TOMORROW", "涙そうそう", "ハナミズキ"
  ];

  const POP_ARTIST_HINTS = [
    "嵐", "SMAP", "NEWS", "KinKi", "Kinki", "AKB48", "乃木坂", "back number",
    "あいみょん", "MONGOL800", "スキマスイッチ", "大塚愛", "西野カナ", "CUTIE STREET"
  ];

  let mananaRankingCache = null;
  const MANANA_CACHE_MS = 24 * 60 * 60 * 1000;

  const AGE_CATEGORIES = [
    {
      id: "all",
      label: "全年代",
      statusLabel: "全年代総合",
      queries: ["カラオケ 人気 ランキング", "邦楽 名曲 総合", "世代を超えた名曲"],
      yearRange: null
    },
    {
      id: "teens",
      label: "10代",
      statusLabel: "最新ヒット",
      queries: ["最新 J-POP ヒット", "Z世代 邦楽", "新人 デビュー シングル"],
      yearRange: [2020, 2026]
    },
    {
      id: "twenties",
      label: "20代",
      statusLabel: "2010年代ヒット",
      queries: ["2010年代 J-POP ヒット", "2015 邦楽 名曲", "令和 ヒット曲"],
      yearRange: [2010, 2019]
    },
    {
      id: "thirties",
      label: "30代",
      statusLabel: "2000年代ヒット",
      queries: ["2000年代 J-POP ヒット", "2000年代 邦楽 名曲", "平成 ヒット曲"],
      yearRange: [2000, 2009]
    },
    {
      id: "forties",
      label: "40代",
      statusLabel: "90年代ヒット",
      queries: ["90年代 J-POP ヒット", "1990年代 邦楽 名曲", "SMAP ヒット", "B'z シングル"],
      yearRange: [1990, 1999]
    },
    {
      id: "fifties",
      label: "50代",
      statusLabel: "80年代ヒット",
      queries: ["80年代 J-POP ヒット", "1980年代 邦楽 名曲", "昭和ポップス ヒット"],
      yearRange: [1985, 1994]
    },
    {
      id: "sixties",
      label: "60代〜",
      statusLabel: "昭和の名曲",
      queries: ["昭和 名曲 ポップス", "70年代 邦楽 ヒット", "80年代前半 ヒット"],
      yearRange: [1965, 1984]
    }
  ];


  let browseMode = "ranking";
  let browseAge = "forties";
  let browseGenre = "total";
  let browseSortOrder = "ranking";
  let browseDisplayLimit = BROWSE_INITIAL_COUNT;
  let artistCatalogArtist = "";
  let addTarget = "canSing";
  let searchGender = "";

  function makeId() {
    return S.makeId();
  }

  function normalizeSong(song, index = 0) {
    return S.normalizeSong(song, index);
  }

  function normalizeInitialSongs() {
    return S.normalizeInitialSongs();
  }

  function safeSaveSongs() {
    const ok = S.safeSaveSongs(songs);
    if (!ok) {
      showToast("保存に失敗しました。バックアップを書き出してください");
      return false;
    }
    if (window.UtaNoteAutoBackup) {
      window.UtaNoteAutoBackup.scheduleSnapshot(songs, settings);
      updateAutoBackupUi();
    }
    return true;
  }

  function saveSettings() {
    S.saveSettings(settings);
    if (window.UtaNoteAutoBackup) {
      window.UtaNoteAutoBackup.scheduleSnapshot(songs, settings);
    }
  }

  function saveSongs() {
    safeSaveSongs();
  }

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFKC")
      .toLocaleLowerCase("ja")
      .replace(/\s+/g, "");
  }

  function formatSingDate(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }

  function isKoreanOrChineseArtist(artist) {
    const text = String(artist || "");
    if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(text)) return true;
    if (/[\u4e00-\u9fff]/.test(text) && !/[ぁ-んァ-ン]/.test(text)) return true;
    return false;
  }

  function isJapaneseCatalogItem(item) {
    const artist = String(item?.artist || "");
    const title = String(item?.title || "");
    if (!artist && !title) return false;
    if (isKoreanOrChineseArtist(artist)) return false;

    if (browseGenre === "western") {
      return isWesternArtistName(artist) || (Array.isArray(item.genres) && item.genres.includes("western"));
    }

    if (isWesternArtistName(artist)) {
      if (Array.isArray(item.genres) && item.genres.includes("western") && !/[ぁ-んァ-ン一-龯]/.test(title)) {
        return false;
      }
      if (!/[ぁ-んァ-ン一-龯]/.test(`${title}${artist}`)) return false;
    }

    if (Array.isArray(item.genres) && item.genres.includes("western") && !/[ぁ-んァ-ン一-龯]/.test(`${title}${artist}`)) {
      return false;
    }

    return true;
  }

  function filterJapaneseCatalog(results) {
    return results.filter(isJapaneseCatalogItem);
  }

  function getResultGenreClass(item) {
    if (browseGenre === "western" || isWesternArtistName(item.artist)) return "western";
    if (matchesRankingGenre(item, "anime") || item.animeShow) return "anime";
    if (matchesRankingGenre(item, "ballad")) return "ballad";
    return "jpop";
  }

  function looksLikeArtistSearch(query, sampleResults = []) {
    const q = normalizeSearchToken(query);
    if (!q || q.length < 2) return false;
    if (/\s/.test(String(query || "").trim())) return false;
    const artistHits = sampleResults.filter((item) => {
      const artist = normalizeSearchToken(item.artist);
      return artist === q || artist.startsWith(q) || artist.includes(q);
    }).length;
    return artistHits >= 3;
  }

  function resetBrowseDisplayLimit() {
    browseDisplayLimit = BROWSE_INITIAL_COUNT;
  }

  function updateLoadMoreButton(totalCount) {
    if (!els.loadMoreBrowse) return;
    const remaining = totalCount - browseDisplayLimit;
    if (remaining <= 0) {
      els.loadMoreBrowse.hidden = true;
      return;
    }
    els.loadMoreBrowse.hidden = false;
    els.loadMoreBrowse.textContent = `もっと見る（あと${Math.min(remaining, BROWSE_PAGE_STEP)}曲 / 全${totalCount}曲）`;
  }

  async function searchArtistCatalog(artistName) {
    const raw = String(artistName || "").trim();
    if (!raw) return [];

    let hits = [];
    if (window.UtaNoteKaraokeMaster?.searchByArtist) {
      hits = window.UtaNoteKaraokeMaster.searchByArtist(raw, 500);
    } else if (window.UtaNoteKaraokeMaster?.getAll) {
      window.UtaNoteKaraokeMaster.getAll().forEach((song) => {
        if (!artistNamesMatch(song.artist, raw)) return;
        hits.push({
          title: song.title,
          artist: song.artist,
          year: song.year,
          gender: song.gender,
          genres: song.genres,
          animeShow: song.animeTitle || "",
          popularity: song.score || 0,
          source: "master"
        });
      });
    }

    const genderScope = browseGenre === "western" ? "western" : "jpop";
    const polished = filterJapaneseCatalog(
      applyGenderFilter(
        filterKaraokeSuitable(hits.map(enrichRankingItem), { relaxed: true }),
        { genderMode: "keyword", scope: genderScope }
      )
    );

    const sortOrder = browseSortOrder === "ranking" ? "title" : browseSortOrder;
    return sortBrowseResults(polished, sortOrder);
  }

  function openArtistCatalog(artistName) {
    const artist = String(artistName || "").trim();
    if (!artist) return;

    artistCatalogArtist = artist;
    browseMode = "keyword";
    els.browseModeButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.mode === "keyword");
    });
    els.keywordSearchWrap.hidden = false;
    els.globalSearch.value = artist;
    renderBrowseFilters();
    resetBrowseDisplayLimit();
    els.globalSearchStatus.textContent = `${artist} の曲を読み込み中…`;
    els.globalSearchResults.innerHTML = "";

    searchArtistCatalog(artist).then((results) => {
      renderGlobalSearchItems(results, `（${artist} の曲）`);
    });
  }

  function getGenderLabel() {
    if (searchGender === "female") return "女性";
    if (searchGender === "male") return "男性";
    return "";
  }

  function getGenderSearchWord() {
    if (searchGender === "female") return "女性歌手";
    if (searchGender === "male") return "男性歌手";
    return "";
  }

  function getTabSongs(tab = settings.tab) {
    const canSing = tab === "canSing";
    return songs.filter((song) => song.canSing === canSing);
  }

  function getVisibleSongs() {
    const query = normalizeText(els.search.value);
    let rows = getTabSongs().filter((song) => {
      if (!query) return true;
      return [song.title, song.artist, song.key, song.tag, song.memo]
        .some((value) => normalizeText(value).includes(query));
    });

    const sort = els.sort.value;
    const byJapanese = (a, b, field) =>
      String(a[field] || "").localeCompare(String(b[field] || ""), "ja", {
        numeric: true,
        sensitivity: "base"
      });

    if (sort === "manual") rows.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    if (sort === "title") rows.sort((a, b) => byJapanese(a, b, "title"));
    if (sort === "artist") rows.sort((a, b) => byJapanese(a, b, "artist") || byJapanese(a, b, "title"));
    if (sort === "favorite") {
      rows.sort((a, b) =>
        Number(b.favorite) - Number(a.favorite) ||
        (b.singCount || 0) - (a.singCount || 0) ||
        (a.order ?? 0) - (b.order ?? 0)
      );
    }
    if (sort === "singCount") {
      rows.sort((a, b) =>
        (b.singCount || 0) - (a.singCount || 0) ||
        Number(b.favorite) - Number(a.favorite) ||
        (a.order ?? 0) - (b.order ?? 0)
      );
    }
    if (sort === "lastSung") {
      rows.sort((a, b) => {
        const aLast = a.singHistory[a.singHistory.length - 1] || "";
        const bLast = b.singHistory[b.singHistory.length - 1] || "";
        return String(bLast).localeCompare(String(aLast)) || (a.order ?? 0) - (b.order ?? 0);
      });
    }
    if (sort === "newest") rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

    return rows;
  }

  function findExistingSong(title, artist) {
    return songs.find((song) =>
      normalizeText(song.title) === normalizeText(title) &&
      normalizeText(song.artist) === normalizeText(artist)
    );
  }

  function getListLabel(canSing) {
    return canSing ? LIST_LABELS.canSing : LIST_LABELS.cannotSing;
  }

  function appendSongToList(title, artist, canSing) {
    const tabSongs = songs.filter((song) => song.canSing === canSing);
    const maxOrder = tabSongs.reduce((max, song) => Math.max(max, Number(song.order) || 0), -1);
    const now = new Date().toISOString();
    const song = normalizeSong({
      id: makeId(),
      title,
      artist,
      canSing,
      order: maxOrder + 1,
      createdAt: now,
      updatedAt: now
    });
    songs.push(song);
    return song.id;
  }

  function highlightAddedSong(songId) {
    highlightSongId = songId;
    clearTimeout(highlightTimer);
    highlightTimer = setTimeout(() => {
      highlightSongId = null;
      render();
    }, 3000);
  }

  function moveSongToList(id, canSing) {
    const song = songs.find((item) => item.id === id);
    if (!song || song.canSing === canSing) return;

    song.canSing = canSing;
    song.updatedAt = new Date().toISOString();
    const tabSongs = songs.filter((item) => item.canSing === canSing && item.id !== id);
    const maxOrder = tabSongs.reduce((max, item) => Math.max(max, Number(item.order) || 0), -1);
    song.order = maxOrder + 1;

    ["canSing", "cannotSing"].forEach((tab) => {
      getTabSongs(tab)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .forEach((item, index) => { item.order = index; });
    });

    saveSongs();
    settings.tab = canSing ? "canSing" : "cannotSing";
    saveSettings();
    render();
    showToast(`「${song.title}」を${getListLabel(canSing)}に移しました`);
  }

  function addSongFromSearch(title, artist, canSing = addTarget === "canSing") {
    const existing = findExistingSong(title, artist);
    if (existing) {
      if (existing.canSing !== canSing) {
        moveSongToList(existing.id, canSing);
      } else {
        settings.tab = canSing ? "canSing" : "cannotSing";
        saveSettings();
        render();
        showToast(`すでに${getListLabel(canSing)}に登録済みです`);
      }
      refreshGlobalSearchResults();
      return;
    }

    const newId = appendSongToList(title, artist, canSing);
    highlightAddedSong(newId);
    saveSongs();
    settings.tab = canSing ? "canSing" : "cannotSing";
    saveSettings();
    refreshGlobalSearchResults();
    render();
    showToast(`「${title}」を${getListLabel(canSing)}に追加しました`);
  }

  async function fetchItunesSongs(query, attribute = null, country = "jp") {
    try {
      const params = new URLSearchParams({
        term: query,
        country,
        media: "music",
        entity: "song",
        limit: "200"
      });
      if (attribute) params.set("attribute", attribute);

      const response = await fetch(`https://itunes.apple.com/search?${params}`);
      if (!response.ok) return [];

      const data = await response.json();
      return (data.results || []).map((item, index) => ({
        title: String(item.trackName || "").trim(),
        artist: String(item.artistName || "").trim(),
        releaseDate: String(item.releaseDate || ""),
        popularity: Math.max(1, 100000 - index * 10)
      }));
    } catch {
      return [];
    }
  }

  function artistNamesMatch(a, b) {
    const left = normalizeText(a);
    const right = normalizeText(b);
    if (!left || !right) return false;
    return left.includes(right) || right.includes(left);
  }

  function getArtistGenderHint(artist) {
    if (typeof window.resolveArtistGender === "function") {
      return window.resolveArtistGender(artist);
    }
    return "unknown";
  }

  function resolveSongGender(item) {
    if (item?.gender === "male" || item?.gender === "female" || item?.gender === "mixed") {
      return item.gender;
    }
    return getArtistGenderHint(item?.artist);
  }

  function applyGenderFilter(results, options = {}) {
    const genderMode = options.genderMode || "default";
    const scope = options.scope || "jpop";

    if (genderMode === "skip") return results;
    if (searchGender !== "male" && searchGender !== "female") return results;

    return results.filter((item) => {
      const gender = resolveSongGender(item);
      if (gender === "mixed") return true;
      if (gender === "male" || gender === "female") {
        return gender === searchGender;
      }
      if (genderMode === "keyword") return true;
      if (genderMode === "knownOnly") return true;
      return false;
    });
  }

  const CLASSICAL_TITLE_RE = /カノン|即興曲|ソナタ|協奏曲|交響曲|組曲|序曲|変奏曲|フーガ|ボレロ|幻想曲|ラプソディ|op\.\s*\d|練習曲|前奏曲|ニ短調|嬰ハ短調|ハ短調|管弦|四重奏|三重奏|二重奏|ワルツ|舞曲|室内楽|吹奏|惑星|組曲/i;
  const CLASSICAL_ARTIST_RE = /バッハ|ベートーヴェン|モーツァルト|ショパン|リスト|ラベル|ハイドン|パヘルベル|チャイコフスキー|ドビュッシー|ブラームス|ホルスト|ゲーシュウィン|ベロフ|パーカー|ドヴォルザーク|メンデルスゾーン|シューベルト|ヴィヴァルディ/i;
  const INSTRUMENTAL_RE = /インスト|instrumental|off vocal|カラオケ音源|伴奏のみ|ピアノ独奏|ヴァイオリン|オルケスタ|オーケストラ|管弦楽|交響楽/i;

  function isGenreTitleOnly(title, blockedWords = []) {
    const normalized = normalizeText(title);
    if (!normalized) return true;

    const defaults = ["バラード", "ロック", "ポップス", "jpop"];
    const words = [...defaults, ...blockedWords.map(normalizeText)];

    if (words.includes(normalized)) return true;
    if (words.some((word) => normalized === word)) return true;
    if (/^バラード[\(（]?/.test(title) && normalized.length <= 14) return true;

    return false;
  }

  function filterKaraokeSuitable(results, options = {}) {
    const blockedTitleWords = options.blockedTitleWords || [];
    const relaxed = Boolean(options.relaxed);

    return results.filter((item) => {
      const title = String(item.title || "").trim();
      const artist = String(item.artist || "").trim();
      if (!title || !artist) return false;

      if (isGenreTitleOnly(title, blockedTitleWords)) return false;
      if (CLASSICAL_TITLE_RE.test(title)) return false;
      if (CLASSICAL_ARTIST_RE.test(artist)) return false;
      if (!relaxed && (INSTRUMENTAL_RE.test(title) || INSTRUMENTAL_RE.test(artist))) return false;
      if (!relaxed && title.length > 55) return false;

      const releaseYear = item.releaseDate ? new Date(item.releaseDate).getFullYear() : null;
      if (releaseYear && releaseYear < 1950) return false;

      return true;
    });
  }

  function getKnownReleaseYearsMap() {
    if (!getKnownReleaseYearsMap.cache) {
      getKnownReleaseYearsMap.cache = new Map(
        KNOWN_RELEASE_YEAR_ENTRIES.map(([title, artist, year]) => [
          `${normalizeText(title)}|${normalizeText(artist)}`,
          year
        ])
      );
    }
    return getKnownReleaseYearsMap.cache;
  }

  function getSongReleaseYearStrict(item) {
    const release = String(item.releaseDate || item.release || "");
    if (release && !release.startsWith("0000")) {
      const year = new Date(release).getFullYear();
      if (Number.isFinite(year) && year > 1950) return year;
    }
    return null;
  }

  function getSongReleaseYearForRanking(item) {
    return getSongReleaseYearStrict(item) ?? getSongReleaseYear(item);
  }

  function getSongReleaseYear(item) {
    const strict = getSongReleaseYearStrict(item);
    if (strict) return strict;
    const key = `${normalizeText(item.title)}|${normalizeText(item.artist)}`;
    return getKnownReleaseYearsMap().get(key) || null;
  }

  function isAnimeRankingItem(item) {
    return Boolean(getAnimeShowName(item) || isAnimeSong(item));
  }

  function matchesRankingGenre(item, genreId) {
    if (genreId === "total") {
      if (isWesternArtistName(item.artist)) return false;
      const blob = `${item.title || ""}${item.artist || ""}`;
      if (Array.isArray(item.genres) && item.genres.includes("western") && !/[ぁ-んァ-ン一-龯]/.test(blob)) {
        return false;
      }
      return true;
    }
    if (Array.isArray(item.genres)) {
      if (genreId === "jpop-rock" || genreId === "jpop" || genreId === "rock" || genreId === "pop") {
        return item.genres.includes("jpop-rock") || item.genres.includes("jpop") || item.genres.includes("rock") || item.genres.includes("pop");
      }
      return item.genres.includes(genreId);
    }
    if (genreId === "western") return isWesternArtistName(item.artist);
    if (genreId === "anime") return isAnimeRankingItem(item);
    return matchesBrowseGenre(item, genreId);
  }

  function sortBrowseResults(results, order = browseSortOrder) {
    if (order === "title") {
      return [...results].sort((a, b) =>
        normalizeText(a.title).localeCompare(normalizeText(b.title), "ja") ||
        normalizeText(a.artist).localeCompare(normalizeText(b.artist), "ja")
      );
    }
    if (order === "artist") {
      return [...results].sort((a, b) =>
        normalizeText(a.artist).localeCompare(normalizeText(b.artist), "ja") ||
        normalizeText(a.title).localeCompare(normalizeText(b.title), "ja")
      );
    }
    return results;
  }

  function updateBrowseSortUi() {
    const show = browseMode === "ranking" || browseMode === "foryou" || browseMode === "keyword";
    if (els.browseSortBar) els.browseSortBar.hidden = !show;
    if (els.browseSortSelect) els.browseSortSelect.value = browseSortOrder;
  }

  function matchesArtistHint(artist, hints) {
    const normalized = normalizeText(artist);
    return hints.some((hint) => normalized.includes(normalizeText(hint)));
  }

  function matchesTitleHint(title, hints) {
    const normalized = normalizeText(title);
    return hints.some((hint) => normalized.includes(normalizeText(hint)));
  }

  function isWesternArtistName(artist) {
    const text = String(artist || "").trim();
    if (!text || /[ぁ-んァ-ン一-龯]/.test(text)) return false;

    const normalized = normalizeText(text);
    if (JAPANESE_LATIN_ARTIST_HINTS.some((hint) => normalized.includes(normalizeText(hint)))) {
      return false;
    }
    if (["Ed Sheeran", "Bruno Mars", "Michael Jackson", "Queen", "Coldplay", "Maroon 5",
      "OneRepublic", "Mark Ronson", "Phil Collins", "Sting", "Elvis Presley", "The Beatles",
      "John Lennon", "Billie Eilish", "Taylor Swift", "Adele", "Drake", "Post Malone"
    ].some((hint) => normalized.includes(normalizeText(hint)))) {
      return true;
    }
    if (/^[A-Z0-9&]{2,8}$/.test(text.replace(/\s/g, ""))) return false;
    return /^[A-Za-z0-9\s&'.,\-!?()]+$/.test(text) && /\s/.test(text);
  }

  function getAnimeShowName(item) {
    const title = String(item.title || "");
    const artist = String(item.artist || "");

    for (const rule of ANIME_SHOW_RULES) {
      if (!matchesTitleHint(title, [rule.title])) continue;
      if (rule.artist && !artistNamesMatch(artist, rule.artist)) continue;
      return rule.show;
    }
    return "";
  }

  function isAnimeSong(item) {
    const title = item.title || "";
    const artist = item.artist || "";
    if (getAnimeShowName(item)) return true;
    if (matchesTitleHint(title, ANIME_TITLE_HINTS)) return true;
    if (matchesArtistHint(artist, ANIME_ARTIST_HINTS)) {
      return !matchesArtistHint(artist, ["米津玄師", "Vaundy", "優里"]);
    }
    return false;
  }

  function classifySongGenre(item) {
    const title = item.title || "";
    const artist = item.artist || "";

    if (isAnimeSong(item)) return "anime";
    if (matchesTitleHint(title, BALLAD_TITLE_HINTS)) return "ballad";
    if (matchesArtistHint(artist, ROCK_ARTIST_HINTS)) return "rock";
    if (matchesArtistHint(artist, POP_ARTIST_HINTS)) return "pop";
    if (isWesternArtistName(artist)) return "western";
    return "jpop";
  }

  function matchesBrowseGenre(item, genreId) {
    const genre = classifySongGenre(item);
    if (genreId === "total") return true;
    if (genre === genreId) return true;
    if (genreId === "jpop-rock" && (genre === "jpop" || genre === "pop" || genre === "rock")) return true;
    if (genreId === "jpop" && (genre === "pop" || genre === "jpop")) return true;
    if (genreId === "pop" && genre === "jpop") {
      return !matchesArtistHint(item.artist, ROCK_ARTIST_HINTS) && !isAnimeSong(item);
    }
    if (genreId === "ballad" && genre === "jpop" && matchesTitleHint(item.title, BALLAD_TITLE_HINTS)) {
      return true;
    }
    return false;
  }

  function rankingSongKey(title, artist) {
    return `${normalizeText(title)}|${normalizeText(artist)}`;
  }

  function dedupeSearchResults(results) {
    const seen = new Set();
    return results.filter((item) => {
      const key = rankingSongKey(item.title, item.artist);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function findRankingMatch(pool, seed) {
    const seedKey = rankingSongKey(seed.title, seed.artist);
    const exact = pool.find((item) => rankingSongKey(item.title, item.artist) === seedKey);
    if (exact) return exact;

    const seedTitle = normalizeText(seed.title);
    return pool.find((item) => {
      const title = normalizeText(item.title);
      if (!title.includes(seedTitle) && !seedTitle.includes(title)) return false;
      return artistNamesMatch(item.artist, seed.artist);
    }) || null;
  }

  function buildRankingItemFromSeed(seed, pool, rankIndex) {
    const matched = findRankingMatch(pool, seed);
    const releaseDate = matched?.releaseDate
      || (seed.year ? `${seed.year}-06-01` : "");
    return {
      title: matched?.title || seed.title,
      artist: matched?.artist || seed.artist,
      releaseDate,
      popularity: matched?.popularity || (3000 - rankIndex),
      gender: seed.gender || resolveSongGender(seed) || matched?.gender || "",
      genres: seed.genres || matched?.genres || [],
      curatedGenre: seed.curatedGenre || (Array.isArray(seed.genres) ? seed.genres[0] : "") || (browseGenre === "anime" ? "anime" : ""),
      animeShow: seed.animeShow || "",
      source: matched?.source || "curated"
    };
  }

  function enrichRankingItem(item) {
    const genre = item.curatedGenre || classifySongGenre(item);
    let animeShow = item.animeShow || "";
    if (!animeShow && (genre === "anime" || browseGenre === "anime" || isAnimeSong(item))) {
      animeShow = getAnimeShowName(item);
    }
    return { ...item, genre, animeShow };
  }

  function mapMananaRow(item, popularity) {
    return {
      title: String(item.title || "").trim(),
      artist: String(item.singer || item.artist || "").trim(),
      releaseDate: String(item.release || ""),
      popularity,
      source: "manana"
    };
  }

  async function fetchMananaPopularRanking() {
    if (mananaRankingCache && Date.now() - mananaRankingCache.fetchedAt < MANANA_CACHE_MS) {
      return mananaRankingCache.items;
    }

    try {
      const [joyRes, damRes] = await Promise.all([
        fetch("https://api.manana.kr/karaoke/popular/joysound/monthly.json"),
        fetch("https://api.manana.kr/karaoke/popular/dam/monthly.json")
      ]);
      const joyData = joyRes.ok ? await joyRes.json() : [];
      const damData = damRes.ok ? await damRes.json() : [];
      const map = new Map();

      const addRows = (rows, baseScore) => {
        rows.forEach((row, index) => {
          if (!row?.title) return;
          const item = mapMananaRow(row, baseScore - index);
          const key = `${normalizeText(item.title)}|${normalizeText(item.artist)}`;
          const current = map.get(key);
          if (!current || item.popularity > current.popularity) {
            map.set(key, item);
          }
        });
      };

      addRows(Array.isArray(joyData) ? joyData : [], 10000);
      addRows(Array.isArray(damData) ? damData : [], 5000);

      const items = [...map.values()].sort((a, b) => b.popularity - a.popularity);
      mananaRankingCache = { items, fetchedAt: Date.now() };
      return items;
    } catch {
      return [];
    }
  }

  function polishSearchResults(results, options = {}) {
    const karaokeFiltered = filterKaraokeSuitable(results, options);
    return applyGenderFilter(karaokeFiltered, options);
  }

  function diversifyByArtist(results, maxPerArtist = 5) {
    const buckets = new Map();
    results.forEach((item) => {
      const key = normalizeText(item.artist);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(item);
    });

    const lists = [...buckets.values()];
    const output = [];
    let progress = true;

    while (progress && output.length < 100) {
      progress = false;
      for (const list of lists) {
        const artistKey = normalizeText(list[0]?.artist);
        const currentCount = output.filter((item) => normalizeText(item.artist) === artistKey).length;
        if (list.length && currentCount < maxPerArtist) {
          output.push(list.shift());
          progress = true;
        }
      }
    }

    return output;
  }

  function analyzeUserTaste() {
    const artistScores = new Map();
    const tagCounts = new Map();
    let favoriteArtists = new Set();

    songs.forEach((song) => {
      if (!song.artist) return;
      let weight = 1;
      if (song.favorite) {
        weight += 12;
        favoriteArtists.add(song.artist);
      }
      weight += Math.min(song.singCount || 0, 25) * 4;
      if (song.canSing) weight += 3;
      artistScores.set(song.artist, (artistScores.get(song.artist) || 0) + weight);

      if (song.tag) {
        song.tag.split(/[,、]/).forEach((part) => {
          const tag = part.trim();
          if (tag) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        });
      }
    });

    const topArtists = [...artistScores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    const topTags = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([tag]) => tag);

    return { topArtists, topTags, favoriteArtists: [...favoriteArtists], hasLibrary: topArtists.length > 0 };
  }

  function getActiveAgeCategory() {
    return AGE_CATEGORIES.find((item) => item.id === browseAge)
      || AGE_CATEGORIES.find((item) => item.id === "forties");
  }

  const CURATED_AGE_GROUPS = {
    teens: "10s",
    twenties: "20s",
    thirties: "30s",
    forties: "40s",
    fifties: "50s",
    sixties: "60s"
  };

  function mapBrowseGenreToTags(genreId, seed) {
    if (genreId === "total") {
      return seed.animeShow ? ["anime", "jpop-rock"] : ["jpop-rock"];
    }
    if (genreId === "jpop-rock" || genreId === "jpop" || genreId === "rock" || genreId === "pop") {
      return ["jpop-rock"];
    }
    return [genreId];
  }

  function enrichCuratedSeed(seed, ageId, genreId, index) {
    const ageGroup = CURATED_AGE_GROUPS[ageId];
    const genres = mapBrowseGenreToTags(genreId, seed);
    if (seed.animeShow && !genres.includes("anime")) genres.unshift("anime");
    return {
      title: seed.title,
      artist: seed.artist,
      year: seed.year || null,
      animeShow: seed.animeShow || "",
      gender: resolveSongGender(seed),
      genres,
      ageGroups: ageGroup ? [ageGroup] : [],
      curatedGenre: genreId === "total"
        ? (seed.animeShow ? "anime" : "jpop-rock")
        : (genreId === "jpop-rock" ? "jpop-rock" : genreId),
      popularity: 5000 - index,
      source: seed.source || "curated"
    };
  }

  function getRankingSeedLimit() {
    return browseGenre === "total" ? 1000 : 500;
  }

  function getRankingResultLimit() {
    return browseGenre === "total" ? 500 : 500;
  }

  function getCuratedRankingSeeds(ageId, genreId) {
    const seedLimit = genreId === "total" ? 1000 : 500;
    const rows = typeof window.getCuratedKaraokeRanking === "function"
      ? window.getCuratedKaraokeRanking(ageId, genreId)
      : [];
    const seeds = rows.map((seed, index) => enrichCuratedSeed(seed, ageId, genreId, index));
    const seen = new Set(seeds.map((song) => rankingSongKey(song.title, song.artist)));

    if (window.UtaNoteKaraokeMaster?.getRanking) {
      window.UtaNoteKaraokeMaster.getRanking({
        ageId,
        genreId,
        gender: searchGender,
        limit: seedLimit
      }).forEach((song) => {
        if (seeds.length >= seedLimit) return;
        const key = rankingSongKey(song.title, song.artist);
        if (seen.has(key)) return;
        seen.add(key);
        seeds.push(enrichCuratedSeed({
          title: song.title,
          artist: song.artist,
          year: song.year,
          animeShow: song.animeShow || "",
          gender: song.gender,
          source: "master"
        }, ageId, genreId, seeds.length));
      });
    }

    return seeds.slice(0, seedLimit);
  }

  async function loadRankingResults() {
    const ageCategory = getActiveAgeCategory();
    const genderScope = browseGenre === "western" ? "western" : "jpop";
    const online = isAppOnline();
    const resultLimit = getRankingResultLimit();
    lastBrowseMeta.offline = !online;
    lastBrowseMeta.localSearch = false;
    lastBrowseMeta.isTotalRanking = browseGenre === "total";

    const seeds = getCuratedRankingSeeds(ageCategory.id, browseGenre);
    const results = [];
    const seen = new Set();

    const tryPush = (raw, popularity) => {
      const filtered = applyGenderFilter([raw], { genderMode: "knownOnly", scope: genderScope });
      if (!filtered.length) return false;
      const item = filtered[0];
      if (!filterKaraokeSuitable([item]).length) return false;
      if (!isJapaneseCatalogItem(item)) return false;
      if (!matchesRankingGenre(item, browseGenre)) return false;
      const key = rankingSongKey(item.title, item.artist);
      if (seen.has(key)) return false;
      seen.add(key);
      results.push(enrichRankingItem({
        ...item,
        popularity: popularity ?? item.popularity ?? 0
      }));
      return true;
    };

    seeds.forEach((seed, index) => {
      if (results.length >= resultLimit) return;
      tryPush(buildRankingItemFromSeed(seed, [], index), 5000 - index);
    });

    if (online && results.length < resultLimit && browseGenre !== "western") {
      const mananaItems = await fetchMananaPopularRanking();
      lastBrowseMeta.curatedOnly = false;
      const mananaLimit = browseGenre === "total" ? 80 : 20;
      mananaItems.slice(0, mananaLimit).forEach((item, index) => {
        if (results.length >= resultLimit) return;
        tryPush(item, 3500 - index);
      });
    } else if (!online) {
      lastBrowseMeta.curatedOnly = true;
    }

    return dedupeSearchResults(filterJapaneseCatalog(results)).slice(0, resultLimit);
  }

  async function loadForYouResults() {
    const taste = analyzeUserTaste();
    const registered = new Set(
      songs.map((song) => `${normalizeText(song.title)}|${normalizeText(song.artist)}`)
    );
    const candidates = new Map();

    const addCandidate = (item, reason, score) => {
      if (!item?.title || !item?.artist) return;
      const key = `${normalizeText(item.title)}|${normalizeText(item.artist)}`;
      if (registered.has(key)) return;

      const current = candidates.get(key);
      if (!current || score > (current.score || 0)) {
        candidates.set(key, {
          title: item.title,
          artist: item.artist,
          popularity: item.popularity || score,
          reason,
          score
        });
      }
    };

    if (taste.hasLibrary) {
      for (const [artist, weight] of taste.topArtists.slice(0, 8)) {
        const masterHits = window.UtaNoteKaraokeMaster?.search
          ? window.UtaNoteKaraokeMaster.search(artist, 20)
          : [];
        masterHits.forEach((item, index) => {
          if (!artistNamesMatch(item.artist, artist)) return;
          const reason = taste.favoriteArtists.includes(artist)
            ? `お気に入りの「${artist}」`
            : `よく歌う「${artist}」`;
          addCandidate(item, reason, 2000 + weight - index);
        });
      }

      for (const tag of taste.topTags) {
        const tagResults = window.UtaNoteKaraokeMaster?.search
          ? window.UtaNoteKaraokeMaster.search(tag, 15)
          : [];
        tagResults.slice(0, 10).forEach((item, index) => {
          addCandidate(item, `登録の「${tag}」系`, 900 - index);
        });
      }

      const karaokeHits = applyGenderFilter(
        await fetchMananaPopularRanking(),
        { genderMode: "knownOnly", scope: "jpop" }
      );
      karaokeHits.slice(0, 30).forEach((item, index) => {
        const related = taste.topArtists.find(([name]) => artistNamesMatch(item.artist, name));
        addCandidate(
          item,
          related ? `「${related[0]}」に近いカラオケ人気曲` : "カラオケ月間ランキング",
          related ? 750 : 400 - index
        );
      });
    } else {
      const karaokeHits = applyGenderFilter(
        await fetchMananaPopularRanking(),
        { genderMode: "knownOnly", scope: "jpop" }
      );
      karaokeHits.slice(0, 60).forEach((item, index) => {
        addCandidate(
          item,
          "カラオケ月間ランキング",
          500 - index
        );
      });
    }

    const ranked = diversifyByArtist(
      [...candidates.values()].sort((a, b) => (b.score || 0) - (a.score || 0)),
      4
    );

    return dedupeSearchResults(
      filterJapaneseCatalog(
        polishSearchResults(ranked)
          .slice(0, 200)
          .map(enrichRankingItem)
      )
    );
  }

  function mergeSearchResults(resultGroups, maxCount = 150) {
    const map = new Map();

    resultGroups.flat().forEach((item) => {
      if (!item.title) return;
      const key = `${normalizeText(item.title)}|${normalizeText(item.artist)}`;
      const current = map.get(key);
      if (!current || (item.popularity || 0) > (current.popularity || 0)) {
        map.set(key, { ...item });
      } else if (item.releaseDate && !current.releaseDate) {
        map.set(key, { ...current, releaseDate: item.releaseDate });
      }
    });

    return [...map.values()]
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, maxCount);
  }

  async function searchExternalSongs(query) {
    const variants = expandSearchQueryVariants(query);
    const masterResults = [];
    const masterSeen = new Set();

    if (window.UtaNoteKaraokeMaster?.search) {
      variants.forEach((variant) => {
        window.UtaNoteKaraokeMaster.search(variant, 80).forEach((item) => {
          const key = `${normalizeText(item.title)}|${normalizeText(item.artist)}`;
          if (masterSeen.has(key)) return;
          masterSeen.add(key);
          masterResults.push({ ...item, source: "master" });
        });
      });
    }

    const artistSearch = looksLikeArtistSearch(query, masterResults);
    const masterLimit = artistSearch ? KEYWORD_ARTIST_LIMIT : 80;

    if (window.UtaNoteKaraokeMaster?.search && artistSearch) {
      variants.forEach((variant) => {
        window.UtaNoteKaraokeMaster.search(variant, masterLimit).forEach((item) => {
          const key = `${normalizeText(item.title)}|${normalizeText(item.artist)}`;
          if (masterSeen.has(key)) return;
          masterSeen.add(key);
          masterResults.push({ ...item, source: "master" });
        });
      });
    }

    let pool = [...masterResults];

    if (isAppOnline() && browseGenre === "western") {
      const fetchTerms = [...new Set([query, ...variants.slice(1, 4)])];
      const itunesGroups = await Promise.all(
        fetchTerms.flatMap((variant) => ([
          fetchItunesSongs(variant),
          fetchItunesSongs(variant, "artistTerm")
        ]))
      );
      pool = mergeSearchResults([masterResults, ...itunesGroups], 120);
    }

    const matched = pool.filter((item) => matchesKeywordQuery(item, query));
    const genreFiltered = applyBrowseGenreFilter(matched);
    const genderScope = browseGenre === "western" ? "western" : "jpop";
    const localized = filterJapaneseCatalog(genreFiltered);
    const resultLimit = artistSearch ? KEYWORD_ARTIST_LIMIT : KEYWORD_DEFAULT_LIMIT;
    return polishSearchResults(
      prioritizeKeywordResults(sortKeywordResults(localized, query), resultLimit),
      { scope: genderScope, genderMode: "keyword" }
    );
  }

  function getKeywordSuggestions(query, limit = 6) {
    const raw = String(query || "").trim();
    if (!raw || !window.UtaNoteKaraokeMaster?.search) return [];

    const variants = expandSearchQueryVariants(raw).slice(0, 4);
    const seen = new Set();
    const suggestions = [];

    variants.forEach((variant) => {
      window.UtaNoteKaraokeMaster.search(variant, 20).forEach((item) => {
        if (!matchesKeywordQuery(item, raw)) return;
        const key = `${normalizeText(item.title)}|${normalizeText(item.artist)}`;
        if (seen.has(key)) return;
        seen.add(key);
        suggestions.push(item);
      });
    });

    const genderScope = browseGenre === "western" ? "western" : "jpop";
    return applyBrowseGenreFilter(
      polishSearchResults(sortKeywordResults(suggestions, raw), {
        scope: genderScope,
        genderMode: "keyword"
      })
    ).slice(0, limit);
  }

  function renderKeywordSuggestions(query) {
    const box = els.searchSuggestions;
    if (!box) return;
    if (browseMode !== "keyword" || !query.trim()) {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }

    const suggestions = getKeywordSuggestions(query);
    if (!suggestions.length) {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }

    box.hidden = false;
    box.innerHTML = "";
    suggestions.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "search-suggestion";
      button.dataset.title = item.title || "";
      button.dataset.artist = item.artist || "";
      button.innerHTML = `
        <span class="search-suggestion-title">${escapeText(item.title)}</span>
        <span class="search-suggestion-artist">${escapeText(item.artist)}</span>
      `;
      button.addEventListener("click", () => {
        els.globalSearch.value = item.artist || item.title || "";
        renderKeywordSuggestions(els.globalSearch.value);
        runGlobalSearch();
      });
      box.appendChild(button);
    });
  }

  async function loadBrowseResults() {
    if (browseMode === "foryou") {
      return loadForYouResults();
    }

    if (browseMode === "ranking") {
      return loadRankingResults();
    }

    return [];
  }

  function formatRankingUpdatedAt(timestamp) {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "";
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const h = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    return `${y}/${m}/${d} ${h}:${min} 更新`;
  }

  function getBrowseStatusLabel() {
    if (browseMode === "foryou") {
      return "俺向け（あなたの登録曲から算出）";
    }
    if (browseMode === "ranking") {
      const age = getActiveAgeCategory();
      const genre = GENRE_FILTER_OPTIONS.find((item) => item.id === browseGenre);
      const genreLabel = genre?.id === "total" ? "総合ランキング" : `${genre?.label || "邦楽"}ランキング`;
      const updated = formatRankingUpdatedAt(mananaRankingCache?.fetchedAt);
      const gLabel = getGenderLabel();
      let label = `${gLabel ? gLabel + "・" : ""}${age.label}・${genreLabel}（JOYSOUND/DAM月間${updated ? `・${updated}` : ""}）`;
      if (lastBrowseMeta.offline) label += "（オフライン）";
      else if (lastBrowseMeta.curatedOnly) label += "（定番リスト）";
      return label;
    }
    const gLabel2 = getGenderLabel();
    return `${gLabel2 ? gLabel2 + "・" : ""}キーワード検索`;
  }

  function getBrowseStatusShort() {
    const genre = GENRE_FILTER_OPTIONS.find((item) => item.id === browseGenre);
    const genreLabel = genre?.id === "total" ? "総合" : (genre?.label || "邦楽");
    if (browseMode === "foryou") return "俺向け";
    if (browseMode === "ranking") {
      const age = getActiveAgeCategory();
      const gLabel = getGenderLabel();
      let label = `${gLabel ? gLabel + "・" : ""}${age.label}・${genreLabel}`;
      if (lastBrowseMeta.offline) label += "・オフライン";
      else if (lastBrowseMeta.curatedOnly) label += "・定番";
      return label;
    }
    const gLabel = getGenderLabel();
    return `${gLabel ? gLabel + "・" : ""}${genreLabel}・キーワード`;
  }

  function bindBrowseFilterOverlay() {
    const details = document.getElementById("browseFilterDetails");
    if (!details || details.dataset.overlayBound) return;
    details.dataset.overlayBound = "1";
    details.addEventListener("toggle", () => {
      if (els.searchDialogInner) {
        els.searchDialogInner.classList.toggle("filter-overlay-open", details.open);
      }
    });

    els.searchDialogInner?.addEventListener("click", (event) => {
      if (!els.searchDialogInner.classList.contains("filter-overlay-open")) return;
      if (details.open && !details.contains(event.target)) {
        details.open = false;
      }
    });
  }

  function renderBrowseFilters() {
    bindBrowseFilterOverlay();
    const showFilters = browseMode === "ranking" || browseMode === "keyword";
    const showAge = browseMode === "ranking";
    const details = document.getElementById("browseFilterDetails");
    if (details) {
      details.hidden = !showFilters;
      if (!showFilters) {
        details.open = false;
        delete details.dataset.ready;
      } else if (!details.dataset.ready) {
        details.open = false;
        details.dataset.ready = "1";
      }
      const summary = details.querySelector(".browse-filter-summary");
      if (summary) {
        const genre = GENRE_FILTER_OPTIONS.find((item) => item.id === browseGenre);
        const genreLabel = genre?.id === "total" ? "総合" : (genre?.label || "邦楽");
        if (browseMode === "keyword") {
          summary.textContent = `ジャンル：${genreLabel}`;
        } else if (browseMode === "ranking") {
          const age = getActiveAgeCategory();
          summary.textContent = `${age.label}・${genreLabel}`;
        } else {
          summary.textContent = "年代・ジャンル";
        }
      }
    }
    if (els.browseAgeFilterRow) els.browseAgeFilterRow.hidden = !showAge;
    els.browseFilterPanel.hidden = !showFilters;

    if (!showFilters) {
      els.browseAgeNav.innerHTML = "";
      els.browseGenreNav.innerHTML = "";
      updateBrowseSortUi();
      if (els.keywordSearchWrap) els.keywordSearchWrap.hidden = browseMode !== "keyword";
      return;
    }

    if (showAge) {
      els.browseAgeNav.innerHTML = AGE_CATEGORIES.map((item) => `
        <button type="button" class="browse-chip${item.id === browseAge ? " active" : ""}" data-age="${item.id}">
          ${escapeText(item.label)}
        </button>
      `).join("");

      els.browseAgeNav.querySelectorAll(".browse-chip").forEach((button) => {
        button.addEventListener("click", () => {
          browseAge = button.dataset.age;
          if (details) details.open = false;
          renderBrowseFilters();
          runGlobalSearch();
        });
      });
    } else {
      els.browseAgeNav.innerHTML = "";
    }

    els.browseGenreNav.innerHTML = GENRE_FILTER_OPTIONS.map((item) => `
      <button type="button" class="browse-chip${item.id === browseGenre ? " active" : ""}" data-genre="${item.id}">
        ${escapeText(item.label)}
      </button>
    `).join("");

    let westernHint = document.getElementById("browseWesternHint");
    if (!westernHint && els.browseGenreNav.parentElement) {
      westernHint = document.createElement("p");
      westernHint.id = "browseWesternHint";
      westernHint.className = "browse-western-hint";
      westernHint.textContent = "たまに歌う定番の洋楽だけ。普段は邦楽タブをお使いください。";
      els.browseGenreNav.parentElement.appendChild(westernHint);
    }
    if (westernHint) {
      westernHint.hidden = browseGenre !== "western";
    }

    els.browseGenreNav.querySelectorAll(".browse-chip").forEach((button) => {
      button.addEventListener("click", () => {
        browseGenre = button.dataset.genre;
        if (details) details.open = false;
        renderBrowseFilters();
        runGlobalSearch();
      });
    });

    updateBrowseSortUi();
    if (els.keywordSearchWrap) els.keywordSearchWrap.hidden = browseMode !== "keyword";
    if (els.searchSuggestions) {
      els.searchSuggestions.hidden = true;
      els.searchSuggestions.innerHTML = "";
    }
  }

  function setBrowseMode(mode) {
    browseMode = mode;
    els.browseModeButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.mode === mode);
    });

    const isKeyword = mode === "keyword";
    els.keywordSearchWrap.hidden = !isKeyword;

    if (mode === "ranking") {
      if (!AGE_CATEGORIES.some((item) => item.id === browseAge)) browseAge = "forties";
      if (!GENRE_FILTER_OPTIONS.some((item) => item.id === browseGenre)) browseGenre = "total";
    }

    renderBrowseFilters();
    runGlobalSearch();
  }

  function updateAddTargetUi() {
    const isCanSing = addTarget === "canSing";
    els.addTargetCanSing.classList.toggle("active", isCanSing);
    els.addTargetCannotSing.classList.toggle("active", !isCanSing);
  }

  function setAddTarget(target) {
    addTarget = target;
    updateAddTargetUi();
  }

  let lastGlobalSearchResults = [];

  function renderGlobalSearchItems(results, statusSuffix = "") {
    lastGlobalSearchResults = results;
    els.globalSearchResults.innerHTML = "";

    if (!results.length) {
      els.globalSearchStatus.textContent = browseMode === "foryou"
        ? "おすすめが見つかりませんでした。曲を増やすか、歌手の性別を切り替えて試してください。"
        : browseMode === "ranking"
          ? "この条件のカラオケ曲が見つかりませんでした。年代やジャンルを変えて試してください。"
          : "見つかりませんでした。別のキーワードで試してください。";
      if (els.browseSortBar) els.browseSortBar.hidden = true;
      updateLoadMoreButton(0);
      return;
    }

    const registeredCount = results.filter((item) => findExistingSong(item.title, item.artist)).length;
    const visibleCount = Math.min(browseDisplayLimit, results.length);
    const statusShort = `${getBrowseStatusShort()} · ${visibleCount}/${results.length}件${registeredCount ? `（登録${registeredCount}）` : ""}${statusSuffix || ""}`;
    els.globalSearchStatus.textContent = statusShort;
    els.globalSearchStatus.title = getBrowseStatusLabel();
    updateBrowseSortUi();
    if (els.browseSortBar) {
      els.browseSortBar.hidden = !(browseMode === "ranking" || browseMode === "foryou" || browseMode === "keyword");
    }

    const displayResults = sortBrowseResults(results, browseSortOrder).slice(0, browseDisplayLimit);

    displayResults.forEach((item, index) => {
      const existing = findExistingSong(item.title, item.artist);
      const genreClass = getResultGenreClass(item);
      const row = document.createElement("article");
      row.className = `karaoke-result genre-${genreClass}${existing ? " registered" : " addable"}`;

      const animeBadge = item.animeShow
        ? `<span class="karaoke-result-anime">${escapeText(item.animeShow)}</span>`
        : "";
      const reasonBadge = item.reason
        ? `<span class="karaoke-reason">${escapeText(item.reason)}</span>`
        : "";
      const listBadge = existing
        ? `<span class="karaoke-list-badge">${getListLabel(existing.canSing)}</span>`
        : "";

      const metaBadges = animeBadge || reasonBadge || listBadge
        ? `<div class="karaoke-result-meta">${animeBadge}${reasonBadge}${listBadge}</div>`
        : "";

      row.innerHTML = `
        <span class="karaoke-rank">${index + 1}</span>
        <div class="karaoke-result-body">
          <div class="karaoke-result-title-row">
            <span class="karaoke-result-title">${escapeText(item.title)}</span>
          </div>
          <button type="button" class="karaoke-result-artist">${escapeText(item.artist || "歌手名不明")}</button>
          ${metaBadges}
        </div>
      `;

      const artistBtn = row.querySelector(".karaoke-result-artist");
      if (artistBtn && item.artist) {
        artistBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          openArtistCatalog(item.artist);
        });
      }

      const action = document.createElement("button");
      action.type = "button";
      if (existing) {
        action.className = "karaoke-result-action badge-registered";
        action.textContent = "登録済み";
        action.addEventListener("click", () => {
          settings.tab = existing.canSing ? "canSing" : "cannotSing";
          saveSettings();
          closeSearch();
          openEdit(existing.id);
          render();
        });
      } else {
        action.className = "karaoke-result-action badge-add";
        action.textContent = "＋ 追加";
        action.addEventListener("click", () => {
          addSongFromSearch(item.title, item.artist, addTarget === "canSing");
        });
      }

      const ytBtn = document.createElement("button");
      ytBtn.type = "button";
      ytBtn.className = "yt-button";
      ytBtn.textContent = "▶ YT";
      ytBtn.setAttribute("aria-label", `${item.title} をYouTubeで検索`);
      ytBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        window.open(
          "https://www.youtube.com/results?search_query=" +
            encodeURIComponent((item.title || "") + " " + (item.artist || "") + " カラオケ"),
          "_blank",
          "noopener"
        );
      });

      const actionCol = document.createElement("div");
      actionCol.className = "karaoke-result-action-col";
      actionCol.append(action, ytBtn);

      row.append(actionCol);
      els.globalSearchResults.append(row);
    });

    updateLoadMoreButton(results.length);
  }

  function refreshGlobalSearchResults() {
    if (!lastGlobalSearchResults.length) return;
    renderGlobalSearchItems(lastGlobalSearchResults);
  }

  async function runGlobalSearch() {
    const requestId = ++globalSearchRequestId;
    resetBrowseDisplayLimit();
    lastBrowseMeta = { offline: !isAppOnline(), curatedOnly: false, localSearch: false };

    if (browseMode === "keyword") {
      const query = els.globalSearch.value.trim();
      if (!query) {
        els.globalSearchStatus.textContent = "曲名や歌手名を入力してください";
        els.globalSearchResults.innerHTML = "";
        lastGlobalSearchResults = [];
        return;
      }

      els.globalSearchStatus.textContent = "検索中…";
      els.globalSearchResults.innerHTML = "";
      lastGlobalSearchResults = [];

      const renderLocalFallback = (suffix) => {
        const local = applyBrowseGenreFilter(searchLocalRegisteredSongs(query));
        if (!local.length) return false;
        lastBrowseMeta.localSearch = true;
        if (requestId !== globalSearchRequestId) return true;
        renderGlobalSearchItems(
          polishSearchResults(sortKeywordResults(local, query), { genderMode: "skip" }),
          suffix
        );
        return true;
      };

      if (!isAppOnline()) {
        if (renderLocalFallback("（登録済み・オフライン）")) return;
        if (requestId !== globalSearchRequestId) return;
        els.globalSearchStatus.textContent = "オフラインです。登録済みの曲に一致がありませんでした。";
        return;
      }

      try {
        let results;
        if (artistCatalogArtist && artistNamesMatch(artistCatalogArtist, query)) {
          results = await searchArtistCatalog(query);
        } else {
          artistCatalogArtist = "";
          results = await searchExternalSongs(query);
        }
        if (requestId !== globalSearchRequestId) return;
        if (results.length) {
          renderGlobalSearchItems(results, "（人気順）");
          return;
        }
        if (renderLocalFallback("（登録済み）")) return;
        renderGlobalSearchItems([]);
      } catch {
        if (requestId !== globalSearchRequestId) return;
        if (renderLocalFallback("（登録済み）")) return;
        els.globalSearchStatus.textContent = "取得に失敗しました。しばらくして再試行してください。";
      }
      return;
    }

    els.globalSearchStatus.textContent = "読み込み中…";
    els.globalSearchResults.innerHTML = "";
    lastGlobalSearchResults = [];

    try {
      const results = await loadBrowseResults();
      if (requestId !== globalSearchRequestId) return;
      renderGlobalSearchItems(results);
    } catch {
      if (requestId !== globalSearchRequestId) return;
      els.globalSearchStatus.textContent = "取得に失敗しました。しばらくして再試行してください。";
    }
  }

  function openSearch(prefill = "") {
    addTarget = settings.tab;
    updateAddTargetUi();
    searchGender = settings.searchGender === "female" ? "female" : settings.searchGender === "male" ? "male" : "";
    updateSearchGenderUi();

    if (prefill) {
      browseMode = "keyword";
      els.globalSearch.value = prefill;
    } else {
      browseMode = "ranking";
      browseAge = "forties";
      browseGenre = "total";
      els.globalSearch.value = "";
    }

    els.browseModeButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.mode === browseMode);
    });
    els.keywordSearchWrap.hidden = browseMode !== "keyword";
    renderBrowseFilters();
    updateBrowseSortUi();

    els.globalSearchStatus.textContent = prefill ? "検索中…" : "読み込み中…";
    els.globalSearchResults.innerHTML = "";
    lastGlobalSearchResults = [];
    els.searchDialog.showModal();

    requestAnimationFrame(() => {
      if (browseMode === "keyword") els.globalSearch.focus();
      runGlobalSearch();
    });
  }

  function closeSearch() {
    els.searchDialog.close();
  }

  function escapeText(value) {
    const span = document.createElement("span");
    span.textContent = value || "";
    return span.innerHTML;
  }

  function updateSearchGenderUi() {
    els.searchGenderAll.classList.toggle("active", searchGender === "");
    els.searchGenderMale.classList.toggle("active", searchGender === "male");
    els.searchGenderFemale.classList.toggle("active", searchGender === "female");
  }

  function setSearchGender(gender) {
    searchGender = gender;
    settings.searchGender = gender;
    saveSettings();
    updateSearchGenderUi();
    runGlobalSearch();
  }

  function updateTabUi() {
    const isCanSing = settings.tab === "canSing";
    els.tabCanSing.classList.toggle("active", isCanSing);
    els.tabCannotSing.classList.toggle("active", !isCanSing);
    els.tabCanSing.setAttribute("aria-selected", String(isCanSing));
    els.tabCannotSing.setAttribute("aria-selected", String(!isCanSing));
  }

  function renderSingStats(song) {
    if (!song || !song.singCount) {
      els.singStats.hidden = true;
      els.singStatsSummary.textContent = "";
      els.singHistoryList.innerHTML = "";
      return;
    }

    const last = song.singHistory[song.singHistory.length - 1];
    els.singStats.hidden = false;
    els.singStatsSummary.textContent = `歌った回数：${song.singCount}回（最後：${formatSingDate(last)}）`;
    els.singHistoryList.innerHTML = [...song.singHistory]
      .reverse()
      .map((date) => `<li>${escapeText(formatSingDate(date))}</li>`)
      .join("");
  }

  function render() {
    updateTabUi();

    const rows = getVisibleSongs();
    const query = els.search.value.trim();
    const tabTotal = getTabSongs().length;

    els.songCount.textContent = query
      ? `${rows.length} / ${tabTotal}曲`
      : `${tabTotal}曲`;
    els.clearSearch.classList.toggle("visible", Boolean(query));
    els.songList.innerHTML = "";

    els.emptyState.hidden = rows.length !== 0;
    if (rows.length === 0) {
      const tabLabel = settings.tab === "canSing" ? LIST_LABELS.canSing : LIST_LABELS.cannotSing;
      if (query) {
        els.emptyMessage.textContent = `「${query}」は${tabLabel}にありません。`;
        els.openSearchFromEmpty.textContent = `「${query}」を検索`;
      } else if (settings.tab === "cannotSing") {
        els.emptyMessage.textContent = "まだ歌いたい曲がありません。ランキングから追加しましょう。";
        els.openSearchFromEmpty.textContent = "ランキングから曲を追加";
      } else {
        els.emptyMessage.textContent = `${tabLabel}がまだ登録されていません。検索から曲を追加できます。`;
        els.openSearchFromEmpty.textContent = "検索から曲を追加";
      }
    }

    const manualReorderAllowed = reorderMode && els.sort.value === "manual" && !query;
    if (els.reorderHint) {
      els.reorderHint.hidden = !manualReorderAllowed;
    }
    if (els.reorder) {
      els.reorder.setAttribute("aria-pressed", String(reorderMode));
    }

    rows.forEach((song, index) => {
      const card = document.createElement("article");
      card.className = `song-card${song.id === highlightSongId ? " song-card-highlight" : ""}`;
      card.dataset.id = song.id;

      const star = document.createElement("button");
      star.className = `star-button${song.favorite ? " on" : ""}`;
      star.type = "button";
      star.setAttribute("aria-label", song.favorite ? "お気に入りを解除" : "お気に入りにする");
      star.textContent = "★";
      star.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleFavorite(song.id);
      });

      const main = document.createElement("div");
      main.className = "song-main";
      main.tabIndex = 0;

      const lastSung = song.singHistory[song.singHistory.length - 1];
      const metaParts = [];
      if (song.singCount > 0) metaParts.push(`${song.singCount}回`);
      if (lastSung) metaParts.push(`最後 ${formatSingDate(lastSung)}`);
      if (song.key) metaParts.push(song.key);

      main.innerHTML = `
        <div class="song-line">
          <h2 class="song-title">${escapeText(song.title)}</h2>
          <p class="song-artist"><button type="button" class="artist-link">${escapeText(song.artist || "歌手名未登録")}</button></p>
        </div>
        ${metaParts.length ? `<div class="song-meta">${metaParts.map((part) => `<span class="badge">${escapeText(part)}</span>`).join("")}</div>` : ""}
      `;

      const artistLinkBtn = main.querySelector(".artist-link");
      if (artistLinkBtn && song.artist) {
        artistLinkBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          openSearch(song.artist);
        });
      }

      main.addEventListener("click", () => openEdit(song.id));
      main.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") openEdit(song.id);
      });

      const actions = document.createElement("div");
      actions.className = "card-actions";

      if (manualReorderAllowed) {
        const reorderControls = document.createElement("div");
        reorderControls.className = "reorder-controls";

        const up = document.createElement("button");
        up.type = "button";
        up.textContent = "↑";
        up.setAttribute("aria-label", "上へ移動");
        up.disabled = index === 0;
        up.addEventListener("click", () => moveSong(song.id, -1));

        const down = document.createElement("button");
        down.type = "button";
        down.textContent = "↓";
        down.setAttribute("aria-label", "下へ移動");
        down.disabled = index === rows.length - 1;
        down.addEventListener("click", () => moveSong(song.id, 1));

        reorderControls.append(up, down);
        actions.append(reorderControls);
      } else {
        if (!song.canSing) {
          const moveCan = document.createElement("button");
          moveCan.type = "button";
          moveCan.className = "move-list-button";
          moveCan.textContent = `${LIST_LABELS.canSing}に移す`;
          moveCan.addEventListener("click", (event) => {
            event.stopPropagation();
            moveSongToList(song.id, true);
          });
          actions.append(moveCan);
        }

        const singNow = document.createElement("button");
        singNow.type = "button";
        singNow.className = "sing-now-button";
        singNow.textContent = "今歌う";
        singNow.addEventListener("click", (event) => {
          event.stopPropagation();
          recordSing(song.id);
        });

        const edit = document.createElement("button");
        edit.className = "edit-button";
        edit.type = "button";
        edit.setAttribute("aria-label", "編集");
        edit.textContent = "›";
        edit.addEventListener("click", (event) => {
          event.stopPropagation();
          openEdit(song.id);
        });

        actions.append(singNow, edit);
      }

      card.append(star, main, actions);
      els.songList.append(card);
    });
  }

  function setTab(tab) {
    settings.tab = tab;
    saveSettings();
    reorderMode = false;
    els.reorder.classList.remove("active");
    render();
  }

  function toggleFavorite(id) {
    const song = songs.find((item) => item.id === id);
    if (!song) return;
    song.favorite = !song.favorite;
    song.updatedAt = new Date().toISOString();
    saveSongs();
    render();
  }

  function recordSing(id) {
    const song = songs.find((item) => item.id === id);
    if (!song) return;

    const now = new Date().toISOString();
    song.singHistory.push(now);
    song.singCount = song.singHistory.length;
    song.updatedAt = now;
    saveSongs();
    render();
    showToast(`「${song.title}」を記録しました（${formatSingDate(now)}・${song.singCount}回目）`);
  }

  function moveSong(id, direction) {
    const tabSongs = getTabSongs()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const index = tabSongs.findIndex((item) => item.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= tabSongs.length) return;

    [tabSongs[index], tabSongs[nextIndex]] = [tabSongs[nextIndex], tabSongs[index]];
    tabSongs.forEach((song, position) => { song.order = position; });
    saveSongs();
    render();
  }

  function syncKeyPicker(value) {
    if (!els.keyPickerButtons) return;
    const buttons = els.keyPickerButtons.querySelectorAll(".key-btn");
    const target = (value === "原曲") ? "" : (value || "");
    let matched = false;
    buttons.forEach((btn) => {
      const isActive = btn.dataset.key === target;
      btn.classList.toggle("active", isActive);
      if (isActive) matched = true;
    });
    if (!matched) {
      // Fall back to 原曲 (data-key="") button
      const defaultBtn = els.keyPickerButtons.querySelector('.key-btn[data-key=""]');
      if (defaultBtn) defaultBtn.classList.add("active");
    }
  }

  function openEdit(id) {
    const song = songs.find((item) => item.id === id);
    if (!song) return;

    els.songId.value = song.id;
    els.dialogTitle.textContent = "曲を編集";
    els.readonlyTitle.textContent = song.title;
    els.readonlyArtist.textContent = song.artist || "歌手名未登録";
    els.listType.value = song.canSing ? "canSing" : "cannotSing";
    els.key.value = song.key || "";
    syncKeyPicker(song.key || "");
    els.tag.value = song.tag || "";
    els.memo.value = song.memo || "";
    els.favorite.checked = Boolean(song.favorite);
    els.moveToCanSing.hidden = song.canSing;
    renderSingStats(song);
    els.editDialog.showModal();
  }

  function closeEdit() {
    els.editDialog.close();
  }

  function saveForm(event) {
    event.preventDefault();

    const id = els.songId.value;
    const song = songs.find((item) => item.id === id);
    if (!song) return;

    const canSing = els.listType.value === "canSing";
    const now = new Date().toISOString();

    Object.assign(song, {
      canSing,
      key: els.key.value.trim(),
      tag: els.tag.value.trim(),
      memo: els.memo.value.trim(),
      favorite: els.favorite.checked,
      updatedAt: now
    });

    saveSongs();
    closeEdit();
    els.search.value = "";
    if ((canSing && settings.tab === "cannotSing") || (!canSing && settings.tab === "canSing")) {
      settings.tab = canSing ? "canSing" : "cannotSing";
      saveSettings();
    }
    render();
    showToast("変更を保存しました");
  }

  function deleteCurrent() {
    const id = els.songId.value;
    const song = songs.find((item) => item.id === id);
    if (!song) return;
    if (!confirm(`「${song.title}」を削除しますか？`)) return;

    songs = songs.filter((item) => item.id !== id);
    ["canSing", "cannotSing"].forEach((tab) => {
      getTabSongs(tab)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .forEach((item, index) => { item.order = index; });
    });

    saveSongs();
    closeEdit();
    render();
    showToast("削除しました");
  }

  function chooseRandom() {
    const rows = getVisibleSongs();
    if (!rows.length) {
      showToast("選べる曲がありません");
      return;
    }
    const song = rows[Math.floor(Math.random() * rows.length)];
    els.search.value = song.title;
    render();
    showToast(`今日は「${song.title}」`);
  }

  function updateRecoveryBanner() {
    if (!els.recoveryBanner) return;
    els.recoveryBanner.hidden = !S.needsRecovery();
  }

  function loadSampleSongs() {
    if (songs.length > 0) {
      showToast("既に曲が登録されています");
      return;
    }
    if (!Array.isArray(window.INITIAL_SONGS) || !window.INITIAL_SONGS.length) {
      showToast("サンプル曲を読み込めませんでした");
      return;
    }
    if (!confirm("約60曲のサンプルを歌える曲に追加しますか？")) return;

    songs = normalizeInitialSongs();
    if (!safeSaveSongs()) return;

    S.clearRecoveryFlag();
    updateRecoveryBanner();
    els.menuDialog.close();
    render();
    showToast(`${songs.length}曲のサンプルを追加しました`);
  }

  async function updateAutoBackupUi() {
    if (!els.autoBackupStatus || !window.UtaNoteAutoBackup) return;
    const list = await window.UtaNoteAutoBackup.listSnapshots();
    if (!list.length) {
      els.autoBackupStatus.textContent = "自動バックアップ: まだありません";
      if (els.restoreAutoBackup) els.restoreAutoBackup.hidden = true;
      return;
    }
    const latest = list[0];
    els.autoBackupStatus.textContent = `自動バックアップ: 最新 ${window.UtaNoteAutoBackup.formatSnapshotLabel(latest)}（最大${window.UtaNoteAutoBackup.MAX_SNAPSHOTS}世代）`;
    if (els.restoreAutoBackup) els.restoreAutoBackup.hidden = false;
  }

  async function restoreFromAutoBackup() {
    if (!window.UtaNoteAutoBackup) return;
    const list = await window.UtaNoteAutoBackup.listSnapshots();
    if (!list.length) {
      showToast("復元できる自動バックアップがありません");
      return;
    }

    const labels = list.slice(0, 5).map((item, index) => `${index + 1}. ${window.UtaNoteAutoBackup.formatSnapshotLabel(item)}`);
    const choice = prompt(
      `復元するバックアップの番号を入力してください（1が最新）\n\n${labels.join("\n")}`
    );
    const index = Number(choice) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= list.length) return;

    const snapshot = list[index];
    if (!confirm(`「${window.UtaNoteAutoBackup.formatSnapshotLabel(snapshot)}」に戻しますか？\n現在の${songs.length}曲は上書きされます。`)) return;

    songs = snapshot.songs
      .map((song, i) => normalizeSong(song, i))
      .filter((song) => song.title);
    if (snapshot.settings) {
      settings = { ...settings, ...snapshot.settings };
      els.sort.value = settings.sort;
      searchGender = settings.searchGender === "female" ? "female" : "male";
      saveSettings();
    }
    if (!safeSaveSongs()) return;

    S.clearRecoveryFlag();
    updateRecoveryBanner();
    els.menuDialog.close();
    render();
    showToast(`${songs.length}曲に復元しました`);
  }

  function updateAppVersionNote() {
    if (!els.appVersionNote) return;
    const version = window.UtaNoteVersion?.app || "1.0.0";
    els.appVersionNote.textContent = `歌ノート v${version}`;
  }

  function exportBackup() {
    const payload = S.buildBackupPayload(songs);
    S.downloadBackupFile(payload, `歌ノート_${new Date().toISOString().slice(0, 10)}.json`);
    els.menuDialog.close();
    showToast("バックアップを書き出しました");
  }

  function importBackup(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        const valid = S.validateImportData(data);
        const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        S.downloadBackupFile(S.buildBackupPayload(songs), `歌ノート_自動バックアップ_${stamp}.json`);

        if (!confirm(
          `自動バックアップをダウンロードしました。\n現在の${songs.length}曲を、読み込んだ${valid.length}曲に置き換えますか？`
        )) return;

        songs = valid
          .map((song, index) => normalizeSong(song, index))
          .filter((song) => song.title);

        if (!safeSaveSongs()) return;

        S.clearRecoveryFlag();
        updateRecoveryBanner();
        els.menuDialog.close();
        render();
        showToast(`${songs.length}曲を読み込みました`);
      } catch (error) {
        alert(`読み込みに失敗しました。\n${error.message}`);
      } finally {
        els.importFile.value = "";
      }
    };
    reader.readAsText(file, "utf-8");
  }

  function showToast(message, options = {}) {
    clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.hidden = false;
    if (options.persist) return;
    toastTimer = setTimeout(() => { els.toast.hidden = true; }, options.duration || 2200);
  }

  function showUpdateAvailableToast() {
    clearTimeout(toastTimer);
    els.toast.innerHTML = `新しいバージョンがあります <button type="button" class="toast-reload-button">再読み込み</button>`;
    els.toast.hidden = false;
    const reloadButton = els.toast.querySelector(".toast-reload-button");
    if (reloadButton) {
      reloadButton.addEventListener("click", () => {
        window.location.reload();
      }, { once: true });
    }
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("./sw.js").then((registration) => {
      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            showUpdateAvailableToast();
          }
        });
      });

      if (registration.waiting && navigator.serviceWorker.controller) {
        showUpdateAvailableToast();
      }

      setInterval(() => {
        registration.update().catch(() => {});
      }, 60 * 60 * 1000);
    }).catch((error) => {
      console.error("Service Worker登録失敗:", error);
    });
  }

  els.sort.value = settings.sort;
  searchGender = settings.searchGender === "female" ? "female" : "male";
  els.tabCanSing.addEventListener("click", () => setTab("canSing"));
  els.tabCannotSing.addEventListener("click", () => setTab("cannotSing"));
  els.search.addEventListener("input", render);
  els.clearSearch.addEventListener("click", () => {
    els.search.value = "";
    els.search.focus();
    render();
  });
  els.sort.addEventListener("change", () => {
    settings.sort = els.sort.value;
    saveSettings();
    if (els.sort.value !== "manual") reorderMode = false;
    els.reorder.classList.toggle("active", reorderMode);
    render();
  });
  els.reorder.addEventListener("click", () => {
    if (els.sort.value !== "manual") {
      els.sort.value = "manual";
      settings.sort = "manual";
      saveSettings();
    }
    reorderMode = !reorderMode;
    els.reorder.classList.toggle("active", reorderMode);
    render();
  });
  els.random.addEventListener("click", chooseRandom);
  els.openSearch.addEventListener("click", () => openSearch(""));
  els.openSearchFromEmpty.addEventListener("click", () => openSearch(els.search.value.trim()));
  els.form.addEventListener("submit", saveForm);
  els.delete.addEventListener("click", deleteCurrent);
  els.moveToCanSing.addEventListener("click", () => {
    const id = els.songId.value;
    if (!id) return;
    moveSongToList(id, true);
    closeEdit();
  });
  els.cancel.addEventListener("click", closeEdit);
  els.closeDialog.addEventListener("click", closeEdit);

  els.menuButton.addEventListener("click", () => {
    updateAutoBackupUi();
    updateAppVersionNote();
    els.menuDialog.showModal();
  });
  els.closeMenu.addEventListener("click", () => els.menuDialog.close());
  els.export.addEventListener("click", exportBackup);
  els.import.addEventListener("click", () => els.importFile.click());
  els.importFile.addEventListener("change", () => {
    const file = els.importFile.files && els.importFile.files[0];
    if (file) importBackup(file);
  });
  if (els.restoreAutoBackup) {
    els.restoreAutoBackup.addEventListener("click", restoreFromAutoBackup);
  }
  if (els.loadSampleButton) {
    els.loadSampleButton.addEventListener("click", loadSampleSongs);
  }
  if (els.recoveryImportButton) {
    els.recoveryImportButton.addEventListener("click", () => els.importFile.click());
  }

  els.closeSearch.addEventListener("click", closeSearch);
  els.searchGenderAll.addEventListener("click", () => setSearchGender(""));
  els.searchGenderMale.addEventListener("click", () => setSearchGender("male"));
  els.searchGenderFemale.addEventListener("click", () => setSearchGender("female"));
  if (els.browseSortSelect) {
    els.browseSortSelect.addEventListener("change", () => {
      browseSortOrder = els.browseSortSelect.value;
      refreshGlobalSearchResults();
    });
  }
  if (els.loadMoreBrowse) {
    els.loadMoreBrowse.addEventListener("click", () => {
      browseDisplayLimit += BROWSE_PAGE_STEP;
      refreshGlobalSearchResults();
    });
  }
  els.globalSearch.addEventListener("input", () => {
    if (browseMode !== "keyword") setBrowseMode("keyword");
    if (artistCatalogArtist && !artistNamesMatch(artistCatalogArtist, els.globalSearch.value.trim())) {
      artistCatalogArtist = "";
    }
    renderKeywordSuggestions(els.globalSearch.value);
    clearTimeout(globalSearchTimer);
    globalSearchTimer = setTimeout(runGlobalSearch, 300);
  });
  els.browseModeButtons.forEach((button) => {
    button.addEventListener("click", () => setBrowseMode(button.dataset.mode));
  });
  els.addTargetCanSing.addEventListener("click", () => setAddTarget("canSing"));
  els.addTargetCannotSing.addEventListener("click", () => setAddTarget("cannotSing"));
  els.searchDialog.addEventListener("click", (event) => {
    if (event.target === els.searchDialog) closeSearch();
  });

  els.editDialog.addEventListener("click", (event) => {
    if (event.target === els.editDialog) closeEdit();
  });

  if (els.keyPickerButtons) {
    els.keyPickerButtons.addEventListener("click", (event) => {
      const btn = event.target.closest(".key-btn");
      if (!btn) return;
      els.key.value = btn.dataset.key;
      syncKeyPicker(btn.dataset.key);
    });
  }
  els.menuDialog.addEventListener("click", (event) => {
    if (event.target === els.menuDialog) els.menuDialog.close();
  });

  const EXTRA_CACHE_TAG = window.UtaNoteVersion?.extraCache || "v47";

  async function loadExtraScriptFromText(text) {
    const blob = new Blob([text], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = url;
      script.onload = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function loadExtraFromServiceWorkerCache() {
    if (!("caches" in window)) return false;
    try {
      const response = await caches.match("./karaoke-master-extra.js");
      if (!response) return false;
      await loadExtraScriptFromText(await response.text());
      return Array.isArray(window.UTA_NOTE_MASTER_EXTRA) && window.UTA_NOTE_MASTER_EXTRA.length > 0;
    } catch {
      return false;
    }
  }

  async function persistExtraCache() {
    if (window.UtaNoteMasterCache && Array.isArray(window.UTA_NOTE_MASTER_EXTRA)) {
      await window.UtaNoteMasterCache.setCachedExtra(EXTRA_CACHE_TAG, window.UTA_NOTE_MASTER_EXTRA);
    }
    if (window.UtaNoteKaraokeMaster?.rebuild) window.UtaNoteKaraokeMaster.rebuild();
    if (els.searchDialog?.open && els.globalSearch?.value?.trim()) runGlobalSearch();
  }

  async function lazyLoadMasterExtra() {
    if (window.UtaNoteMasterCache) {
      try {
        const cached = await window.UtaNoteMasterCache.getCachedExtra(EXTRA_CACHE_TAG);
        if (Array.isArray(cached) && cached.length > 0) {
          window.UTA_NOTE_MASTER_EXTRA = cached;
          await persistExtraCache();
          return;
        }
      } catch {
        // fall through
      }
    }

    if (await loadExtraFromServiceWorkerCache()) {
      await persistExtraCache();
      return;
    }

    const script = document.createElement("script");
    script.src = "./karaoke-master-extra.js";
    script.onload = () => {
      persistExtraCache();
    };
    document.head.appendChild(script);
  }

  registerServiceWorker();

  render();
  updateSearchGenderUi();
  updateRecoveryBanner();
  updateAppVersionNote();
  if (window.UtaNoteAutoBackup) {
    window.UtaNoteAutoBackup.saveSnapshot(songs, settings).then(() => updateAutoBackupUi());
  }
  setTimeout(lazyLoadMasterExtra, 0);
})();
