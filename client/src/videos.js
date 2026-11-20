/**
 * Vidéos publicitaires servies par le site (/media/videos) et embarquées dans
 * l'application Android. Format vertical 1080 × 1920, 8 secondes, sans son :
 * elles peuvent donc démarrer seules, en boucle, sans gêner la lecture.
 */
export const PROMO_VIDEOS = [
  {
    id: 'pour-une-femme',
    title: 'Pour une femme que j’aime',
    author: 'Alexandre Anderson G',
    line: '« Elle était comme un premier rayon de soleil… »',
    src: '/media/videos/pour-une-femme-que-j-aime.mp4',
    poster: '/media/videos/poster-pour-une-femme-que-j-aime.jpg',
    cta: 'Commencer le roman',
    to: '/lire/pour-une-femme-que-j-aime/1',
  },
  {
    id: 'les-larmes',
    title: 'Les Larmes d’une Plume',
    author: 'Alexandre Anderson G',
    line: '« Certaines larmes ne coulent pas des yeux. »',
    src: '/media/videos/les-larmes-d-une-plume.mp4',
    poster: '/media/videos/poster-les-larmes-d-une-plume.jpg',
    cta: 'Commencer le roman',
    to: '/lire/les-larmes-d-une-plume/1',
  },
  {
    id: 'light-in-the-dark',
    title: 'Light in the Dark',
    author: 'Alexandre Anderson G',
    line: '« Quand l’amour naît dans l’ombre… »',
    src: '/media/videos/light-in-the-dark.mp4',
    poster: '/media/videos/poster-light-in-the-dark.jpg',
    cta: 'Commencer le roman',
    to: '/lire/light-in-the-dark/1',
  },
  {
    id: 'si-je-t-aimais',
    title: 'Si je t’aimais au présent',
    author: 'Alexandre Anderson G',
    line: 'Deux chapitres offerts, sans compte.',
    src: '/media/videos/si-je-t-aimais-au-present.mp4',
    poster: '/media/videos/poster-si-je-t-aimais-au-present.jpg',
    cta: 'Commencer le roman',
    to: '/lire/si-je-t-aimais-au-present/1',
  },
  {
    id: 'chaine',
    title: 'La chaîne WhatsApp',
    author: 'BOOK FOREVER',
    line: 'Les nouveautés avant tout le monde.',
    src: '/media/videos/chaine-whatsapp.mp4',
    poster: '/media/videos/poster-chaine-whatsapp.jpg',
    cta: 'Rejoindre la chaîne',
    channel: true,
  },
];
