export const NAME_MODERATION_VERSION = 1;

// Ordinary profanity is exact-match only to avoid false positives inside otherwise
// harmless callsigns. Severe sexual terms and slurs also use substring matching.
const EXACT_BLOCKED = [
  // English
  'arse', 'asshole', 'bastard', 'bitch', 'bollocks', 'bullshit', 'cock', 'dick', 'douche', 'fuck', 'fucker', 'fucking', 'hentai', 'motherfucker', 'porn', 'pussy', 'rape', 'rapist', 'shit', 'shithead', 'slut', 'whore',
  // Filipino / Tagalog
  'bobo', 'burat', 'gaga', 'gago', 'jakol', 'kantot', 'leche', 'pekpek', 'potangina', 'puta', 'putangina', 'tanga', 'tangina', 'ulol',
  // Bisaya / Cebuano
  'atay', 'bilat', 'buang', 'giatay', 'kayata', 'oten', 'pisti', 'piste', 'yawa', 'yawaa', 'yawaka',
];

const SEVERE_SUBSTRINGS = [
  'childporn', 'cunt', 'faggot', 'fuck', 'nigger', 'nigga', 'pedophile', 'pornhub', 'retard', 'sexslave',
  'kantot', 'pekpek', 'potangina', 'putangina', 'tangina',
  'bilat', 'kayata',
];

const ALLOWLIST = new Set([
  'assassin', 'bilateral', 'classic', 'classical', 'compassion', 'drape', 'grape', 'grass', 'passion', 'scunthorpe', 'shitake', 'therapist', 'putahe',
]);

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '2': 'z', '3': 'e', '4': 'a', '5': 's', '6': 'g', '7': 't', '8': 'b', '9': 'g' };
const compact = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
const collapseRepeats = (value: string) => value.replace(/(.)\1+/g, '$1');
const leetFold = (value: string) => [...value].map(char => LEET[char] ?? char).join('');
const canonical = (value: string) => collapseRepeats(leetFold(compact(value)));

const EXACT_KEYS = new Set(EXACT_BLOCKED.flatMap(term => [compact(term), canonical(term)]));
const SEVERE_KEYS = [...new Set(SEVERE_SUBSTRINGS.flatMap(term => [compact(term), canonical(term)]))];

export function isCallsignAllowed(value: string): boolean {
  const plain = compact(value);
  if (!plain) return false;
  const folded = leetFold(plain), collapsed = collapseRepeats(folded);
  if (ALLOWLIST.has(plain) || ALLOWLIST.has(folded) || ALLOWLIST.has(collapsed)) return true;
  const variants = new Set([plain, folded, collapsed]);
  if ([...variants].some(variant => EXACT_KEYS.has(variant))) return false;
  return ![...variants].some(variant => SEVERE_KEYS.some(term => variant.includes(term)));
}
