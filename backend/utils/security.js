/**
 * AntiScamShield — server-side email sanitization and abuse prevention.
 * Applied at registration time only. Never trust client-supplied emails.
 */

const DISPOSABLE_DOMAINS = new Set([
  // Mailinator family
  "mailinator.com", "trashmail.com", "guerrillamail.com", "guerrillamail.info",
  "guerrillamail.biz", "guerrillamail.de", "guerrillamail.net", "guerrillamail.org",
  "sharklasers.com", "guerrillamailblock.com", "grr.la", "guerrillamail.io",
  // 10 Minute Mail family
  "10minutemail.com", "10minutemail.net", "10minutemail.org", "10minutemail.de",
  "10minutemail.co.uk", "10minutemail.us", "10minutemail.info", "10minemail.com",
  // TempMail family
  "tempmail.com", "temp-mail.org", "tempmail.net", "tempmail.io", "temp-mail.io",
  "temporarymail.com", "tmpmail.net", "tmpmail.org",
  // Yopmail
  "yopmail.com", "yopmail.fr", "cool.fr.nf", "jetable.fr.nf", "nospam.ze.tc",
  "nomail.xl.cx", "mega.zik.dj", "speed.1s.fr", "courriel.fr.nf", "moncourrier.fr.nf",
  // Throwaway / fake
  "throwam.com", "throwaway.email", "spamgourmet.com", "spamgourmet.net",
  "spamgourmet.org", "spamspot.com", "spam4.me", "spamfree24.org",
  "spamfree24.de", "spamfree24.info", "spamfree24.biz", "spamfree24.eu",
  // Discard / Fake inbox
  "discard.email", "discardmail.com", "discardmail.de", "trashmail.at",
  "trashmail.io", "trashmail.me", "trashmail.net", "trashmail.org",
  "trashmail.xyz", "fakeinbox.com", "fakeinbox.net", "mailnull.com",
  // Shareable / Disposable
  "maildrop.cc", "mailnesia.com", "mailnull.com", "spamgob.com",
  "getairmail.com", "filzmail.com", "filzmail.de",
  // GuerrillaMail variations
  "jourrapide.com", "armyspy.com", "cuvox.de", "dayrep.com", "einrot.com",
  "fleckens.hu", "gustr.com", "kurzepost.de", "objectmail.com", "obobbo.com",
  "rhyta.com", "superrito.com", "teleworm.us", "vomoto.com", "wuuvo.com",
  // Misc known disposable
  "nada.email", "getnada.com", "spamgap.com", "mytemp.email",
  "emailondeck.com", "mohmal.com", "tempr.email", "dispostable.com",
  "mailfreeonline.com", "givmail.com", "owlpic.com", "tempemail.co",
  "tempemail.net", "throwam.com", "0-mail.com", "0815.ru", "0815.su",
  "0clickemail.com", "1pad.de", "20minutemail.com", "2prong.com",
  "byom.de", "chammy.info", "chewiemail.com", "childsavetrust.org",
  "correo.blogos.net", "cosmorph.com", "courrieltemporaire.com",
  "cubiclink.com", "curryworld.de", "cust.in", "dacoolest.com",
  "dandikmail.com", "dayrep.com", "dcemail.com", "deadaddress.com",
  "deadletter.ga", "deagot.com", "dealja.com", "despam.it",
  "devnullmail.com", "dfgh.net", "digitalsanctuary.com", "dingbone.com",
  "discardmail.de", "disposableaddress.com", "disposableemailaddresses.com",
  "disposableinbox.com", "disposemail.com", "dispostable.com",
  "dodgeit.com", "dodgemail.de", "donemail.ru", "dontreg.com",
  "dontusethis.com", "drdrb.com", "dump-email.info", "dumpandfuck.com",
  "dumpmail.de", "dumpyemail.com", "e4ward.com", "easytrashmail.com",
  "email60.com", "emailias.com", "emailigo.com", "emailinfive.com",
  "emailsensei.com", "emailtemporario.com.br", "emailto.de", "emailwarden.com",
  "emailx.at.hm", "emailxfer.com", "emz.net", "enterto.com",
  "ephemail.net", "etranquil.com", "etranquil.net", "etranquil.org",
  "explodemail.com", "express.net.ua", "extremail.ru", "eyepaste.com",
  "fakemailz.com", "fakemail.fr", "fastacura.com", "fastchevy.com",
  "fastchrysler.com", "fastkawasaki.com", "fastmazda.com", "fastmitsubishi.com",
  "fastnissan.com", "fastsubaru.com", "fastsuzuki.com", "fasttoyota.com",
  "fastyamaha.com", "filbert8.com", "fivemail.de", "fizmail.com",
  "flurre.com", "flurred.com", "frapmail.com", "freundin.ru",
  "front14.org", "fudgerub.com", "fux0ringduh.com", "fyii.de",
  "garbagemail.org", "gardenscape.ca", "gedmail.win", "gelitik.in",
  "get2mail.fr", "getonemail.com", "getonemail.net", "ghosttexter.de",
  "gishpuppy.com", "glitch.sx", "goemailgo.com", "gotmail.net",
  "gotmail.org", "gowikibooks.com", "gowikicampus.com", "gowikicars.com",
  "gowikifilms.com", "gowikigames.com", "gowikimusic.com", "gowikinetwork.com",
  "gowikitravel.com", "gowikitv.com", "grandmamail.com", "grandmasmail.com",
  "great-host.in", "greensloth.com", "gsrv.co.uk", "guerrillamail.biz",
]);

export class AntiScamShield {
  /**
   * Strip Gmail dots and plus-aliases to get the canonical address.
   * Only applies dot-stripping to Gmail/Googlemail domains.
   * Plus-alias stripping is universal.
   */
  getCanonicalEmail(email) {
    if (!email || typeof email !== "string") return "";
    const lower = email.trim().toLowerCase();
    const atIdx = lower.indexOf("@");
    if (atIdx === -1) return lower;

    let local = lower.slice(0, atIdx);
    const domain = lower.slice(atIdx + 1);

    // Strip plus-alias universally (user+alias@domain → user@domain)
    const plusIdx = local.indexOf("+");
    if (plusIdx !== -1) local = local.slice(0, plusIdx);

    // Strip dots only for Gmail/Googlemail (jo.hn@gmail.com → john@gmail.com)
    if (domain === "gmail.com" || domain === "googlemail.com") {
      local = local.replace(/\./g, "");
    }

    return `${local}@${domain}`;
  }

  /**
   * Returns true if the email's domain is a known disposable provider.
   */
  isDisposable(email) {
    if (!email || typeof email !== "string") return false;
    const atIdx = email.lastIndexOf("@");
    if (atIdx === -1) return false;
    const domain = email.slice(atIdx + 1).toLowerCase().trim();
    return DISPOSABLE_DOMAINS.has(domain);
  }

  /**
   * Unified registration check. Returns { ok, canonical, error }.
   * Call this before inserting any new account.
   */
  validateRegistration(rawEmail) {
    if (!rawEmail || typeof rawEmail !== "string") {
      return { ok: false, canonical: null, error: "Email is required." };
    }

    const trimmed = rawEmail.trim().toLowerCase();
    const emailRe = /^[^\s@,]+@[^\s@,]+\.[^\s@,]{2,}$/;
    if (!emailRe.test(trimmed)) {
      return { ok: false, canonical: null, error: "Invalid email address." };
    }

    if (this.isDisposable(trimmed)) {
      return {
        ok: false,
        canonical: null,
        error: "Disposable email addresses are not allowed. Please use your real email.",
      };
    }

    const canonical = this.getCanonicalEmail(trimmed);
    return { ok: true, canonical, error: null };
  }
}

export const antiScamShield = new AntiScamShield();
