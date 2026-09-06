import arrowDown from "@/assets/icons/arrow-down.png";
import arrowUp from "@/assets/icons/arrow-up.png";
import backArrow from "@/assets/icons/back-arrow.png";
import chat from "@/assets/icons/chat.png";
import checkmark from "@/assets/icons/check.png";
import close from "@/assets/icons/close.png";
import dollar from "@/assets/icons/dollar.png";
import email from "@/assets/icons/email.png";
import eyecross from "@/assets/icons/eyecross.png";
import google from "@/assets/icons/google.png";
import home from "@/assets/icons/home.png";
import list from "@/assets/icons/list.png";
import lock from "@/assets/icons/lock.png";
import map from "@/assets/icons/map.png";
import marker from "@/assets/icons/marker.png";
import out from "@/assets/icons/out.png";
import person from "@/assets/icons/person.png";
import pin from "@/assets/icons/pin.png";
import point from "@/assets/icons/point.png";
import profile from "@/assets/icons/profile.png";
import search from "@/assets/icons/search.png";
import selectedMarker from "@/assets/icons/selected-marker.png";
import star from "@/assets/icons/star.png";
import target from "@/assets/icons/target.png";
import to from "@/assets/icons/to.png";
import check from "@/assets/images/check.png";
import getStarted from "@/assets/images/get-started.png";
import message from "@/assets/images/message.png";
import noResult from "@/assets/images/no-result.png";
import onboarding1 from "@/assets/images/onboarding1.png";
import onboarding2 from "@/assets/images/onboarding2.png";
import onboarding3 from "@/assets/images/onboarding3.png";
import signUpCar from "@/assets/images/signup-car.png";

export const images = {
  onboarding1,
  onboarding2,
  onboarding3,
  getStarted,
  signUpCar,
  check,
  noResult,
  message,
};

export const icons = {
  arrowDown,
  arrowUp,
  backArrow,
  chat,
  checkmark,
  close,
  dollar,
  email,
  eyecross,
  google,
  home,
  list,
  lock,
  map,
  marker,
  out,
  person,
  pin,
  point,
  profile,
  search,
  selectedMarker,
  star,
  target,
  to,
};

export const onboarding = [
  {
    id: 1,
    title: "Vos déplacements au Cameroun en toute sérénité!",
    description:
      "Trouvez un trajet sûr et rapide avec VORA à Yaoundé, Douala et partout ailleurs.",
    image: images.onboarding1,
  },
  {
    id: 2,
    title: "Retrouvez vos repères locaux connus",
    description:
      "Naviguez facilement vers les marchés, carrefours et lieux emblématiques.",
    image: images.onboarding2,
  },
  {
    id: 3,
    title: "Payez en Mobile Money ou Espèces",
    description:
      "Réglez vos courses via MTN Mobile Money, Orange Money (CamerPay) ou en espèces.",
    image: images.onboarding3,
  },
];

export const VORA_THEME = {
  colors: {
    primary: "#0EA5E9", // Bleu Ciel VORA
    primaryDark: "#0284C7", // Bleu Ciel Profond
    secondary: "#38BDF8", // Bleu Ciel Lumineux
    background: "#F8FAFC", // Blanc Pur / Ice White
    white: "#FFFFFF",
    glassBg: "rgba(255, 255, 255, 0.85)",
    glassBorder: "rgba(224, 242, 254, 0.6)",
    accent: "#F59E0B", // Doré / Amber
    dark: "#0F172A",
  },
  glassStyle: {
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(224, 242, 254, 0.8)",
    shadowColor: "#0EA5E9",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
};

export const data = {
  onboarding,
};
