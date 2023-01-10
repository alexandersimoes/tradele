import { DateTime } from "luxon";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "react-toastify";
import {
  countries,
  getCountryName,
  sanitizeCountryName,
  countryISOMapping,
  fictionalCountries,
  Country,
  getOecCountryCode,
  usaStates,
} from "../domain/countries";
import { useGuesses } from "../hooks/useGuesses";
import { CountryInput } from "./CountryInput";
import * as geolib from "geolib";
import { Share } from "./Share";
import { Guesses } from "./Guesses";
import { useTranslation } from "react-i18next";
import { SettingsData } from "../hooks/useSettings";
import { useMode } from "../hooks/useMode";
import { useCountry } from "../hooks/useCountry";
import axios from "axios";
import { TreeMap } from "./TreeMap";

function getDayString() {
  return DateTime.now().toFormat("yyyy-M-dd");
}

const MAX_TRY_COUNT = 6;

interface GameProps {
  settingsData: SettingsData;
}

export function Game({ settingsData }: GameProps) {
  const { t, i18n } = useTranslation();
  const dayString = useMemo(getDayString, []);
  const isAprilFools = dayString === "2022-04-01";

  const countryInputRef = useRef<HTMLInputElement>(null);

  const countryData = useCountry(`${dayString}`);
  let country = countryData[0];

  if (isAprilFools) {
    country = {
      continent: "",
      code: "AJ",
      latitude: 42.546245,
      longitude: 1.601554,
      name: "Land of Oz",
    };
  }

  const [tradeData, setTradeData] = useState(null);
  const [ipData, setIpData] = useState(null);
  const [won, setWon] = useState(false);
  const [currentGuess, setCurrentGuess] = useState<string>("");
  const [countryValue, setCountryValue] = useState<string>("");
  const [guesses, addGuess] = useGuesses(dayString);
  const [hideImageMode, setHideImageMode] = useMode(
    "hideImageMode",
    dayString,
    settingsData.noImageMode
  );
  const [rotationMode, setRotationMode] = useMode(
    "rotationMode",
    dayString,
    settingsData.rotationMode
  );

  const gameEnded =
    guesses.length === MAX_TRY_COUNT ||
    guesses[guesses.length - 1]?.distance === 0;

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!country) return;
      const getIpData = async () => {
        const res = await axios.get("https://geolocation-db.com/json/");
        setIpData(res.data);
      };
      const items = isAprilFools ? fictionalCountries : usaStates;

      const guessedCountry = items.find((country) => {
        return (
          sanitizeCountryName(
            getCountryName(i18n.resolvedLanguage, country)
          ) === sanitizeCountryName(currentGuess)
        );
      });

      if (guessedCountry == null) {
        toast.error(t("unknownCountry"));
        return;
      }

      const newGuess = {
        name: currentGuess,
        distance: geolib.getDistance(guessedCountry, country),
        direction: geolib.getCompassDirection(guessedCountry, country),
      };

      addGuess(newGuess);
      setCurrentGuess("");
      setCountryValue("");

      if (newGuess.distance === 0) {
        setWon(true);
        getIpData();
        toast.success(t("welldone"), { delay: 2000 });
      }
    },
    [addGuess, country, currentGuess, i18n.resolvedLanguage, t, isAprilFools]
  );

  useEffect(() => {
    const getIpData = async () => {
      const res = await axios.get("https://geolocation-db.com/json/");
      setIpData(res.data);
    };
    if (
      guesses.length === MAX_TRY_COUNT &&
      guesses[guesses.length - 1].distance > 0
    ) {
      const countryName = country
        ? getCountryName(i18n.resolvedLanguage, country)
        : "";
      if (countryName) {
        toast.info(countryName.toUpperCase(), {
          autoClose: false,
          delay: 2000,
        });
      }
      getIpData();
    }
  }, [country, guesses, i18n.resolvedLanguage]);

  useEffect(() => {
    if (ipData) {
      axios.post("/tradle/score", {
        date: new Date(),
        guesses,
        ip: ipData,
        answer: country,
        won,
      });
    }
  }, [guesses, ipData, won, country]);

  useEffect(() => {
    // const oecCountryCode = getOecCountryCode(country);
    // if (oecCountryCode) {
    //   getData(oecCountryCode);
    // }
    //
    // const todaysLocation = getLocation();
    const getData = async (oecCountryCode: string) => {
      // `https://oec.world/olap-proxy/data.jsonrecords?Exporter+Country=${oecCountryCode}&Year=2020&cube=trade_i_baci_a_92&drilldowns=HS4&measures=Trade+Value&parents=true`
      const { data } = await axios.get(`/tradle/data?date=${dayString}`);
      setTradeData(data);
    };
    const todaysLocation = country?.code;
    if (todaysLocation) {
      getData(todaysLocation);
    }
  }, [country, dayString]);

  // let iframeSrc = "https://oec.world/en/tradle/aprilfools.html";
  const oecLink = "https://oec.world/";
  // const country3LetterCode = get3CharCode(country);
  // if (!isAprilFools) {
  //   iframeSrc = `https://oec.world/en/visualize/embed/tree_map/hs92/export/${country3LetterCode}/all/show/2020/?controls=false&title=false&click=false`;
  //   oecLink = `https://oec.world/en/profile/country/${country3LetterCode}`;
  // }

  return (
    <div className="flex-grow flex flex-col mx-2 relative">
      {hideImageMode && !gameEnded && (
        <button
          className="border-2 uppercase my-2 hover:bg-gray-50 active:bg-gray-100 dark:hover:bg-slate-800 dark:active:bg-slate-700"
          type="button"
          onClick={() => setHideImageMode(false)}
        >
          {t("showCountry")}
        </button>
      )}
      <h2 className="font-bold text-center">
        Guess which US State exports these products!
      </h2>
      <div
        style={{
          alignItems: "center",
          display: "flex",
          height: 315,
          justifyContent: "center",
          width: "100%",
        }}
      >
        {tradeData ? <TreeMap tradeData={tradeData} /> : <div>Loading...</div>}
      </div>
      {rotationMode && !hideImageMode && !gameEnded && (
        <button
          className="border-2 uppercase mb-2 hover:bg-gray-50 active:bg-gray-100 dark:hover:bg-slate-800 dark:active:bg-slate-700"
          type="button"
          onClick={() => setRotationMode(false)}
        >
          {t("cancelRotation")}
        </button>
      )}
      <Guesses
        rowCount={MAX_TRY_COUNT}
        guesses={guesses}
        settingsData={settingsData}
        countryInputRef={countryInputRef}
        isAprilFools={isAprilFools}
      />
      <div className="my-2">
        {gameEnded ? (
          <>
            <Share
              guesses={guesses}
              dayString={dayString}
              settingsData={settingsData}
              hideImageMode={hideImageMode}
              rotationMode={rotationMode}
              isAprilFools={isAprilFools}
            />
            <a
              className="underline w-full text-center block mt-4 flex justify-center"
              href={oecLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
              {t("showOnGoogleMaps")}
            </a>
            {isAprilFools ? (
              <div className="w-full text-center block mt-4 flex flex-col justify-center text-2xl font-bold">
                <div>🐶 🚲 🌪 🏚</div>
                <div>Happy April Fools!</div>
                <div>👠 🤖 🦁 🎍</div>
              </div>
            ) : null}
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="">
              <CountryInput
                countryValue={countryValue}
                setCountryValue={setCountryValue}
                setCurrentGuess={setCurrentGuess}
                isAprilFools={isAprilFools}
              />
              {/* <button
                className="border-2 uppercase my-0.5 hover:bg-gray-50 active:bg-gray-100 dark:hover:bg-slate-800 dark:active:bg-slate-700"
                type="submit"
              >
                🌍 {t("guess")}
              </button> */}
              <div className="text-left">
                <button className="my-2 inline-block justify-end bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded items-center">
                  {isAprilFools ? "🪄" : "🌍"} <span>Guess</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
