// scripts/delete-non-selected-products.ts
//
// Conserva los 511 productos seleccionados y borra TODOS los demás.
//
// ── CÓMO CORRERLO ──────────────────────────────────────────────────────────
//   npx ts-node --project tsconfig.scripts.json scripts/delete-non-selected-products.ts
//   npx ts-node --project tsconfig.scripts.json scripts/delete-non-selected-products.ts --dry-run

import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

const serviceAccountPath = path.join(process.cwd(), "credentials", "firebase-service-account.json");

if (!fs.existsSync(serviceAccountPath)) {
  console.error("\n❌ No se encontró credentials/firebase-service-account.json\n");
  process.exit(1);
}

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();
const isDryRun = process.argv.includes("--dry-run");

// ── 511 IDs a CONSERVAR ────────────────────────────────────────────────────
const KEEP_IDS = new Set<string>([
  "WS9a14Pm2x1dVvjM08Sj", "nywS8noOKwI9F8TZIh5k", "1ujBrPAABMqifOAXqX6n", "UL0L5SFxpykxu90yOObB", "Q3TF6Q2rHy6S1IO7hlmE", "DYSjuseUrDB67BhCOTSW", "UtaeX6bCsT2JHqC5uAN3", "0vhiiNBNdzO8ZI37l2NR",
  "JsRJ5sIcpbaOPdiR2eFT", "0YlE5mJkMYzwGAeIsr9c", "3MvmtLYDWQ5j1S3mR5Xy", "IWWwqb7VqLMxlCcp4yOe", "fJyizkLfmH2EoCSgv1CR", "rf8lpGYapbOpJz0HwoQD", "uhiv8ukMW6SxQF5xH30k", "gYm3jlISSy543QLCUXHZ",
  "lqV8rZBgGENgMq5WKHU8", "GiQ4lxjqRRwNlIreJHLu", "GXKI5YHwo4FFoIFl43y9", "YC82NtOtgfpiXAe4hQ48", "eyYrqEPR9PJQCDLYX06W", "W3pLz3MCF5E0LfX6Iobk", "fli2Jg9uEox11hnr6plK", "kIRzR9pihreMjPrUugZ7",
  "VcuFHouAqPMDOqlep41S", "GWE1rp6JOLxwGBV4mRhe", "W4OIpAqgcdP0LaDTF6gm", "IhRzZzmQqd5KpH7fArT0", "zhsBHAL3ufhYd8ePl0Yj", "g8pzMVYCVBqem1ZPMs9D", "yEHHZIG88VpyuwN0p42o", "t2rSJfiMdVxLvxPpqsy2",
  "8ZgxQJ6shTCGtnt0TXHb", "MUuGdTyxQJ17JMUdTlr5", "7132eIxTjXF6GFnwoG2s", "iE4OVyoeN3cLXVCSKkl7", "QgyA3GP71EGKmy6edPVx", "kJpZCqlKmVTV7xYk6xCp", "wNk2dqvamybVWIUN72uT", "k7xDWdLj2OFV4Y8O7udO",
  "oKvY0ke0KvfsFxfEAG4i", "VFWxmFSXdWoIUpoENfKe", "A6I3bXRx379Y9P3gpxdC", "n6eSaFu4nEFmxOIqjwBv", "VUWBGMWtnj0QFHK3lXAU", "0UPRe27jmf6uxy11Bv9b", "v5OXEhOSyMFLiBjKangm", "pQBXaQRoiGuHYSxDKpMh",
  "mrheT1dKTMmguc5yzjq5", "b7C7yfiS0Wq8IaSbGmRA", "rzggnkjVMSqMTIIPlXBg", "vrvbURK5cvBXdPGBZFX7", "Qg7z9s7ajMpw7ExMJJs6", "V0uixBOGUjzexY0OYRs9", "hLsRL3CNZ3VQdlpKGp9O", "SRJcC6VCoUNLsdBQciz0",
  "1IRwzLyuZZqNjZR75jmQ", "fv6M5U0LeqLolGIycDSe", "S5954F8GENgxTmpglXKL", "i5RttKNsKw5rXnFHXIeh", "BBfGvtCemX2HKnNMZrWa", "F37tyGRrQ588JFT4nGXD", "0Qs0ahQubbuMV6zw88oX", "dTZfrUX4iMklQGZqedYP",
  "uRtCz3ZzmSI7rRsHG7x1", "CRl8yaFE5mM6KNQSks9P", "Y4WUWZNBqUPu23jf7egr", "GCQRyEBg1nFMgKNAjZWI", "MCqpPYkGPa8gvHn7ECUK", "LZoywCdGyCFuV9at8Moy", "pJdXhsAL1MFpQJG5ckRa", "aXr1wF53HKSGRAkBN0YG",
  "m3w7Sq66bLHSuBcdo1FV", "susb2ls4xtmpxqZgUeHh", "KoWY19sDqqsr5kwJh5FX", "TvnPdLIRlmVyPrv7xWMM", "jfKDOn5gwumaALr9x4DA", "JMGgrSAf1NIHCCndDM6t", "qPxuB7AaVWNqZK3eMfxq", "LdJnA0VvHS3bnqy5pPL7",
  "nieiTub8Zhv036WHe8VI", "l1nu2TzpXdCiP3oS9c8F", "Fc6wxu7WKkaGTVtBhfzU", "NMyARVglXno1rBUB8bQw", "ApnVGIuQo5M2HclyZIm8", "jEAJI6Ka7KmKX9hOOdQW", "nyS4mm199mzFGIAemlqt", "XOOmI9k6tpv8BkAeJSVb",
  "9NqQ0wExK8KNEzY8F3Kd", "CUzPkHBnwhxqgK9Wk9Nh", "8RS3XnuZMxPR7kMcLSDE", "lK7RYt50sZ6HtKkJVFqX", "zsBE5XKJRhmvAHshWudM", "WYF14fn9UWby1b3wwXtF", "hsSK17PTe8I06fVEWHQ4", "e7IubyvV0dotkuKB2fjW",
  "Gva44RbI2IujcN6nCQxO", "Ag1F4IDcQolUKDc1eOSL", "CcObmRWZz9k0z4vzkeMD", "J2H7FTJQxxX4LuA9UXtE", "DCRP6IN1AtIkE8EjNq11", "QnCcE24SBxc8GoRp74ND", "w3R1Q5fWj3U1m9oDH031", "TMu6BMvGVqdO0ozHiRp2",
  "Q3QUwNcOQ3vKE4QYcNr4", "NYYqzIls0DJYme5kRHR4", "NLWp3nrham1jRjMbwsFq", "44DeZUf0IFbzurTzTOKv", "ryH7hmKqEzuyBhwyQ5b9", "DaqaU6cXG9d3BanwYI4H", "Q9s5gsGfBStXTMmJ2U8T", "HJHXQqlOjeR4N6tz4Nwh",
  "eEx96Vhvb9Am2IpcT4K3", "hooypNnwBPIvqwAfjJwz", "nTsdNGsTIoBtTLcio00m", "80orZqJAkFtBfbNGzani", "1l57nK9mUBvAiWC119Hr", "mxsY95VPpOCbSlh80RuR", "h6UoWYUf4QMHg77IYyaX", "URnxjLDHG9oRBy1ESIED",
  "XzpY0S2E7MEaj1xQUA9p", "QW9j8xr5fPIJey0DpVZY", "7PRqrjwgxICUzcpZYNHN", "L1b09SMvXfLEdCA2GLxx", "MS5VBMHUECrwUZSQ1yto", "cYlCjaNTTS4yBbacRptu", "kszfnPpLAMFolNhri1ph", "nuScgPXthyjJvKQmmkoJ",
  "V7CWbId2Y4ZoQ9MA1zu5", "F9YQhvzEWNIHhryF2g47", "xoVINHJp5u0kwp5z5043", "RSx723M44YCRaev4JL0L", "OOAo97LKLMUf8JZ5qFEO", "O8lmBu90onQSFcfD2gRY", "f30WGyVJiaI5X8KqdtZW", "yi7VO4PF4MIhzK0naYEc",
  "b4Gz7J30PZxy60VD9mv6", "AuuBM6s6ZM95TnA6LfM5", "Cu3BfR0noZw4EdJovz5D", "VhgsXBVeIvUwxF9LiLGs", "TDNfS2WbBKOGUvFLGEZN", "hAX0Vijmbv83ZCTktKjJ", "3Hxk8059PaiQzvy4ukSR", "amhNvcxApHEM6xZGG0WO",
  "rMN1AHB3hRclyyCURuYU", "UyKShC41r5HecdqhmqDw", "FmJmF0PL8CJU0UdFXICN", "UmATufrq22HAoLk2cNkN", "f5krDk9jBjNYmQ0dJZI2", "XFgcCqE59xO9V73kCcRg", "bFsG0KJwN5cgnvfmWaHJ", "BfCNJNGmJBCgNqRa45ga",
  "lU8LKJBdoyOhHMvXDbnE", "jvzKj7eWnxBSpOz5wVMY", "jqhLQUXfzFNugykFy0iU", "IyF6S8zWcF8zBeWdk8pQ", "b8M38cIOHU9Dp50szOjT", "P8NBTTNXZaNxsXK9SvQC", "j3Tl0LS4a8qHISwfPFeL", "NO9rzgj9gciibHvBwlf0",
  "tfmjztrd9k1eApncZFxX", "7LFE0fXwXoetiIKYyftg", "sVV3rRz8K2ysfyIY8hsK", "n7TkwqPVHWLyJSY34anH", "uuRf6O7qQR0xMvXBgkI3", "6J94AoaEZr2mIdBt9yCT", "C2tVMaeMjv6yxUWPpqJz", "EzlJNsDqll6coSNZUnMx",
  "Y3UGvgCw3OYLP7BXGsZ8", "3rKwduQsdjBlpawkYoZ9", "fPDxX5xEL7fsz9nwQGRk", "sMkRlONSmN2xupdGtH4w", "rFLNlQvCZF11lQJMMHvp", "VzmaL8j72e3QvA1yPVJf", "twK7ANyTmgAmKydZhZht", "FazKgts5HPG7OFluJb3M",
  "pSrXhvYBDs7OuFWvoYBX", "RwyuOboTZ4fwY5RyvjA3", "GLzIxZPSFdNozyyIKckJ", "ke6QA7pe97Yre5T1wotJ", "fiMkNhmYsOWOiTyXCL4e", "WpZUUPwrbcJnh1f7d7fC", "6pegj64pJPL6qtYYRZWE", "1SFx4H5tywNMuv1JZVJ7",
  "obeO8HS14JyDfudp0JAg", "XeGj5FFQUOM1o9Ky4taO", "Uz3jAuzc9jckJdA9OKKO", "ToPpkVkJfjUtmO6y2em5", "gryvYlWXZkuFisFwAmk1", "7bodPdTH8CLz8ILbl63b", "J42VTaev3yWySRocR9Az", "tCBbFxfR6MKwAp7Kj6cx",
  "wSYNNPYFTOyhXmDb7DcA", "2P1MSlt0AqjfxH7rppRh", "7oQDyV7GtqgUQBF0FDFC", "pgUqh9JmrAXdJuileZOc", "itk2wnS2C5xI6o2AMZhs", "lyYvZJiWhGNYEbkWKQpr", "UuJnUio3dtSQ1Eokhtsz", "eKeFE0szCwLVmuTyUU98",
  "xmtZIzBipUN6HGyhHHbR", "Sr5bfxbAGV3pb08ErRjU", "FrSL9j5mOrPnfyzH1hef", "DpykIiiyRxZgvjtLvclp", "BZQps0A850seqGLNYwvx", "gWfCb76RRivzyMQxfVOL", "BYWKRiXS0UOFlcxJ9IfZ", "ZiCLv5uEXbscJyePuJ3V",
  "CcBl2GZ2puhC3Nalf7co", "FvvX02wa5g6ToUCVUZ5d", "95G9a1mzBWqz4tBPlCMh", "wTDIbixb4lMNwq11kqQb", "QMtKce32Lcy4aJJeXt2M", "DFnddN37XFHsqUcLse2u", "EBGfm2eyR3fzKoxEh3iE", "LldZ420H0cFwf396zABj",
  "WuoG57b6eYFmZW4f48PN", "ZRCb8zN0zzdvAuiG7qvd", "MkH7EmuYTPCn7yEf02oO", "elLaOVx5l6BIIvrRIj4D", "bUuz2xAlbvWKNmA82L1H", "W1VrKf12vCKmNpO6DRou", "WB4kbNfDYVXIXm6t35pQ", "ve6KNzzub9N68X1SrrbT",
  "AccDjES3YyucI1bj0sdn", "tUraf7Q9Yxjn0q0FbGCb", "zV0z3pWQgv0lunvsyBAY", "tWz6N1hOCTxLn3xrAkU3", "V87HK6DhxqyTtUQvGvtk", "1ufKJcPHdP37nVzZ7hHE", "RtaOOUkQOCAt58rsWxZ0", "xrbzfNw1kv8wFnGHlXEN",
  "AGMevwRdc7RiZqiuGyrz", "Z1LIPcy1WfJDuSRxBrHH", "1180bHKSuQO64uO8v17H", "tNQ6YRrPy8iUjMTovVyD", "B5s86w6kw3UVIMKhTKiF", "Bn57HjgCqDsR562AqgLu", "I5PYFA1LwHjhyCusJvsZ", "H8vNAiRpSKhHf5LXjYnM",
  "bLYviVnhdDaMAo60hF5T", "9bDnwEPWopKmmcGWxkVA", "hAh6T4AlGrYUfPakGIfW", "lDRKHWDcbXVC29aQeDS4", "2iTiPFxNYhpFgjlhRfpo", "gi0fJMpgK99Ppae2RUC4", "TwiTcPVfo4mqmj8fOdvI", "ErOTUjtGDagokxLmKTiw",
  "bTULYGO5UxKkfE7G2GHa", "jmYha2szKVhaW9RQzYvh", "JvxKtAcsdI42x2jQmBJ2", "XIOtutklrdh51jjVlbmS", "VKC1a5caeANv29LVZ56N", "WLdAIMBnskJ9XMHmHvl4", "8sKMzt3bxIItWBy2Itaq", "j45aNw0x2CsVHUt0ED9i",
  "LecWrafzf7likXoTXUK8", "kvR32VM1sLq7EieCByCC", "QI6FdSehDL3iYo7aVgJH", "6fA8wLviWpeBUzDP76QO", "6RA5yFSVRx1XYaZZwDcy", "D5Q4u5eRHyLp9uZ8n3qD", "GjC0vwmTqlmcuNNPSJn4", "5FqSZK6BzLg125PSHTei",
  "UxhnSddhIUIiRAASzLCW", "Kmc0WAwmhuvGV36teqv4", "yXHSVaaaxsVshtMub95X", "mCz0uHQ0hU8e2Ih2Zklk", "23nvXQJut5eH4HACpbRN", "QkarakDyR83ohjAgVTRQ", "M06aeJzlDCMf2wLFsZ4t", "ERHmUA4qwWCEzh7PYUQE",
  "uyCre7Ed7DuOCVqKyT9x", "6jLOWfruvKUKoH4P7sw1", "XQINWWBFbMbbCSM21NSF", "inrFvRtBTPAK8xpzwkQ3", "Jnqn8kpOvQh2jLNa2klo", "hCDK6i1STC8hscEmOWJj", "HpPTmraUmKqPDSKyKgRu", "pWjha64S8sgc3PZHs8kV",
  "AAKk9FqsPNTg6sqkJTF5", "dFrbHxSYsT6NInLpfVLJ", "Iz4LBEFyU8pW5Zajo46S", "jAjaJbNoAqskgXIitDjh", "znnEJurgxohsEABS6oBj", "S1b57Dp57fwG9qUyQtKJ", "zoLlUFVa26MywKjQNYKY", "O1fbJGbvv6I3YmQV6YKN",
  "2nA5NMHQJ6fSKwbEU0eC", "tUoS7RGYhsk4rMBWDtlI", "47jdMJthVK2vAlGVckqz", "LScfzZGS9tuyT4WigFBw", "xJjM1QHaGgpgo5PgQDtH", "KyNwSy8Ci2jfqx1GaN3d", "FqJCiX20Oe0UOseWQpKL", "aLZEMChGSq81i1tskZgf",
  "hcqdQroidbLRkYitSjP4", "4UXuJxNVWu1YJOuN5jb6", "MeEmSOGVnwLwkvhG8U0D", "9CZJN2gMOSJ1lnRAWYSZ", "nCD1WNhPaMeLH2w1lZe1", "eV6PihJuWvbwn0x4TJhQ", "aK5I277arGGCIMyvMBGz", "NHMDyWTIwiXt82cZXHCk",
  "D2zK4dnPE0ZHUbB15dj5", "wGVkRwTUKwE0sn55CEtn", "veTVhlwJQ6OXgCojsusc", "Vj7u5SBuyhKfmFXi5qt0", "uK8O2zOrtMIvCkwgThKz", "pQU6zuBikpZmjKwtZEIn", "me2RICmYtu9MY33b4gvg", "fR9xorgJNTpGZ4LVEQOg",
  "QlaDNoXNt3uh0LHDS9cG", "m8ZdAesi2tUK7ztDdtyq", "twHxV4WCiJvfeShjpegc", "v5tdBFwbZDjfltTfNmo3", "98va0uIBgnjcRNkS8ucb", "ZszFxUKb6BxMiEkEbeZb", "9joyH8Il82YMHnmGkztP", "9L9e9r3ZF0rsRBuPds7x",
  "grQCqtOG01Lt2hm8TuMd", "sCWXF5LoUHtZNzDlm5MJ", "GtiORCpQPLwYDLfAonFL", "5DB93eerMKdFgBcAkZOd", "1tEtUVDvTLfQwmCBpPfF", "9jp0ipIdkjyODdRY9v1Z", "kCPg2hB84j9MV4J0Ldqz", "P6MDrTV43DZG0X3OhRlW",
  "IiYKXyj593WJInJOMQNo", "K8XrckILUZwwcoujgC5j", "QVtsFKfbAM1fYgLR97ij", "lyvSFD736x4ATZbJbswN", "bpS3jwQOTNTVHSjTH6RY", "p4WGvMBDkQyhn1aSD162", "msnEXe1X9d70eTqsaxi4", "PjlTSANkDBFVkhbbsoTN",
  "OmahSMbes8ObQWIn0LIK", "l2XCiO8IAkyzKGhjYyhR", "hxEBcD0NRHM7MaS8s3Hk", "QdBUw2Znxx1TifVVlgBA", "izYiZ30k2fFBBGq2cbtC", "RSoTsKoiokqa7kaK2Arv", "Nit37ayLaTbCsCiU7Dh6", "Vl1uRZH7IQYKMeaI1BK3",
  "TV3K3mKJTsV0xH3mWgMb", "IeVI0zQVkYozjZB2Purm", "muxBkGQY9kva1D05DmTT", "ZMYIB5PPlJAvStNWkwWP", "b6CVTifGtJYtQTiDAv8g", "LEWGXF1YXlYDdkPY4bjO", "pBBsjq4u54n9rnENPhEo", "M1Bsof0rm88v9D4EAZWq",
  "LA0hPXU1oRIz69slhuee", "JBC0fiXRA0iGV6RAfEAC", "8DrhKgEDYhUVU6kk59Wn", "PoWWglw1y0bRqwPsfz1K", "T97Q66x0rBQVwNe9jGLl", "YVNT7WhrCK2pf9EIrNpr", "vIwgBEYIqEonVbUb1uKy", "BcxWYWkBH7pmRHMPFegt",
  "qIIrHVHYXuo37rzThruV", "0nksGE5yKLeNDUT0nT5h", "81oCMG7WK2Qd4JAhYsrH", "VhcbyFcdL27a02JzBJwX", "vGL6XzoEJaslNLFcL25F", "ny74I0UOh5bkskbJQFJB", "2S9Ts11SNVu7ToqjwIWi", "OusbUihgTy1l8kWyJ0Em",
  "7EqbZS4GzRi0f3jEqR5z", "nWyulkmwNIbkXMuJoem6", "i77rZClIrCGoqdaK5NvR", "sO4xR5SiV9SlW3TLWwqv", "SQjlywu8tYqDWzRwOlq4", "5HAKEwPFm4HPOROzgnGy", "tU4S1KvEqMgIJ2LFPFJ2", "4xu6cHCVYFgjcmZnDqLB",
  "jTwbfiaOrw7CyofhSbaE", "dwfaY5WVQv6ioml8PquL", "bMb5fx1HkSc0ApX3oHbO", "XhegpgN1fhsq6zKu5f3v", "I0w2f5Y93W9XDCBULd9L", "9lbC54EjndIxK8XH2dfb", "wK8gOBsA8BSgGpQdGIfM", "AvsfgN4keduqhq2KKcsY",
  "jR6LTbJGCl2SHBTvp2Br", "Krg4CqOUaQ8JhetZJd9K", "JwtRXkrrjTWoTq1Fayo6", "FXRdJ0ofTeSnKzwLEsoD", "kYUv06oRWM0SypLOek0w", "bSTAowinU0by9cSjRXvy", "KsFtlox6nPDWZ1ma2Ckb", "c6jt32bqEPJjC0b3yQYw",
  "jL06ijplCuslGmQtSsBq", "mMSUZOJiS7x10B7dmHGU", "0tANcB6uyAhRqlawXNxq", "41WE6n3fQvrf1F2w9PTN", "d4ybj7p8f9KZoXw1lKMp", "q8zJn3Z9SfXZif9FBCD0", "hisnUzNlQDzBqNeaa4lc", "8kpS3mMi6nVlXxDh7hUu",
  "9loY1sb9wG4bQupp6Rxs", "CIQK46UeiybWMTwmzVic", "rm5IJfAK9KsDSC1dyOch", "gpWm2hffkXtg4014jCde", "0XsEUPzJXazdCq7hT5j4", "bdxrSz2gZbN8O9VNYgqk", "GcM1nKurOz4QHiFs1JaY", "18viuMchkv3WrhUdW0ED",
  "cnrGQw5rAcrCVx9QalFv", "quN3cQOulp5vdK7Frmvh", "Ew4t10i4dEf6HWUYwcpw", "Q2NG9uZbeO5K2Tumw71G", "Z0D8i4bL7wCmymzxU2Sj", "XQ1YZg9V6ftRVmnSktJf", "NMJCjX7Hf2AIA4PdrEC6", "yfqbcXOdvMhEH8faBDyG",
  "DdKd0Qpkv1urhamcyU9Y", "S4nstUM7lpUlWiVo7Go5", "KBcRagEu6bTifk0TwBmb", "5bvzP67FIeCSUjwBI6N5", "b8Y3J1qggELm7ei1ec72", "Vc0mI3YicByW1coclVOY", "FJt0nEQ43K77ZCQb9Tv9", "cISXJU8TQIPj2Loji1JG",
  "vu1EOftRP57QwN2ASJT7", "s6Yre4WToa0uywvWV0SY", "cvA3uUCtG79uZc8TbzqP", "5d0LWuXBM7fpBr27SNCQ", "S8IwZEw8Q3J2RQfqRhgG", "Qi2SRlzG5XsmoaqNcNSu", "DM9L7vXDKWlRE0qUErOB", "88vVb3hV0AmKAB2JvHqM",
  "dTZsspbXgP66bWjjR8pc", "JL5iexBtZfAKE8OdK9GR", "Ij6VtUHyfM7xyfFYTaC5", "5DkmlwRbr4AzuotgUWOy", "mvq1YbsJ4Eb8Tp2A7pjl", "HVXHvvBpzZ4aYmrD5aUd", "NfppwB2jPVRwzVu789D8", "6UwnLxOq7vd3cWVFUkgl",
  "DFKt6YPK49V6IRPZKCaS", "IcxODOJltRrUWT6nYFmr", "1Ci1m8NphM8MX5y62F9V", "V8cEHPkDJoRmxhjZQzSc", "QIQpW3ltlX4MhZ2aJdsh", "mEFvgOQNsaXFW3piZLEq", "WSaGxRLq8uylaUSU3Ew3", "IyfujzhjjW7PZ6bF9Uq8",
  "02q9POvvT0ql38D9pRct", "LC3T3VLwTX5kROaCeD1y", "tXyyJFrmHIWkjnxzbevB", "FkbZyNeoz9WTiWCbOtOo", "e6aHtYd27syfYnPEIqaI", "s3vbNPuIlmwAIscxu4Jv", "KQ7MDD0gvEIXtuNTjf8r", "dqkDE6Tv6q5Y9CkNtT4r",
  "G6PhSsi6Ux7oQWxC9OA0", "FENQ7p3ILPl4HaQae2yj", "inOG0e24x2qLakN0ZALq", "KQPgAREwBMDiMjtDfTc9", "xZNDgey20gN4IPzPA3wD", "SW1RuhcGXwjGCFlEtnsD", "4xw3d9H6ARQGcELpGENv", "0iiRUrgw7jVeTOvUmL0k",
  "ceBGSZ99RCLI2iqGTsNe", "gwtb6n2C2zX6EMYQZpPD", "vpPLAnRigmjBYbl45mao", "8Bp7S7iKg88OTy9KqkgV", "BI6ONWadDHTTrKtbz3Qy", "WZLKUD3HHLbbg4P4NyhP", "BYl85lwHBn3qpCo47HAD", "Oc3fncLP9pP6b9JGa9dy",
  "PozN70DxZPe9V4370Cp3", "W4KsXSQ5fbLKAxHYssKw", "j3zyOQo5oqfSuWnQmvHh", "gm77xlmaRbk1T17lFJ99", "sp6hQK1jBNxKkOA5Pgwh", "KL2LArmRVQSqRM5sBmvv", "2iqnSjulzteefyNJhErl", "Z3aykclpaJsxLCuN5wU5",
  "NrHOpoZYspQuc2ZfbPVd", "gQ78XHlTbeZUDZfcvdYl", "mRm5yiLL48BAX3KU2PYX", "oDpaGbwCJBkvvm6JeO3h", "pe2vOQA5GnXH3HqHFjqV", "Vv1sqRIpBb1fXY2292Ek", "JhLruSz9nSoVU88jLMVB", "1DoYU9B2uBlcuR6zxkml",
  "pCJfcvcrKZVNPtgmb8FK", "W0kRdLGtx1e80TGgKIkk", "l9SJXFZosDymhkzNIyPV", "u8SR0miY8V8TfN4PD1Fq", "QLcXJtniMAQxqkdROp2P", "kfhbLiBbqt48GJspuQPf", "GMPUdFkBp2UeXj9Nm1ao", "BiW7ekBLdXZs5hqgCxHi",
  "sMLjXXYYnvyeHy9KsHnp", "5nJT2l3B5qz41VFCjWa1", "NZuEv4R5jGHCwn0YPQ2W", "TZNcLOuLqZ9QGBfIl1Zb", "Ka7aGDrweDA1kWO3LNlg", "67OAMuQU0EnwmfgrOLxi", "CJ9uxx0amL2yPTNyZBvA", "a6hp644le4RwRYP4WUWb",
  "svjbQr2mZPecUI75aqCe", "oF22RrsWvxbc1s8xZ49d", "VzZZawsBGK7cqBTaXPHv", "Io8JzrrdulqL4co9KQU0", "YVAShnb6u7klPWhpkjsR", "huZFJ4W1y2wgZrcatnWX", "lT65wc5Nx0Tp9GPCj1Ni",
]);

async function main() {
  console.log("\n════════════════════════════════════════════════════════");
  console.log("  delete-non-selected-products — MayoristaMovil");
  console.log("════════════════════════════════════════════════════════");
  console.log(`  Modo:            ${isDryRun ? "🔍 DRY RUN (no borra nada)" : "🗑️  BORRADO REAL"}`);
  console.log(`  IDs a conservar: ${KEEP_IDS.size}`);
  console.log("════════════════════════════════════════════════════════\n");

  console.log("📥 Descargando todos los productos de Firestore...");
  const snap = await db.collection("products").get();
  console.log(`   Total en Firestore: ${snap.docs.length}`);

  const toDelete = snap.docs.filter(doc => !KEEP_IDS.has(doc.id));
  const toKeep   = snap.docs.filter(doc =>  KEEP_IDS.has(doc.id));

  console.log(`\n✅ Productos a CONSERVAR: ${toKeep.length}`);
  console.log(`🗑️  Productos a BORRAR:    ${toDelete.length}`);

  if (toDelete.length === 0) {
    console.log("\nNada que borrar.\n");
    process.exit(0);
  }

  if (isDryRun) {
    console.log("\n  ℹ️  DRY RUN — no se borró nada.");
    console.log("  Corré sin --dry-run para borrar de verdad.\n");
    process.exit(0);
  }

  // Borrar en batches de 400
  const BATCH_SIZE = 400;
  let totalDeleted = 0;

  console.log("\n🗑️  Borrando...");
  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const chunk = toDelete.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    chunk.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    totalDeleted += chunk.length;
    console.log(`   ✅ ${totalDeleted}/${toDelete.length} productos borrados`);
  }

  console.log("\n════════════════════════════════════════════════════════");
  console.log(`  ✅ Listo. ${totalDeleted} productos borrados.`);
  console.log(`  📦 Quedan ${toKeep.length} productos en Firestore.`);
  console.log("════════════════════════════════════════════════════════\n");
  process.exit(0);
}

main().catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});