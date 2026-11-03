import { LocationQuiz } from '../shared/LocationQuiz'
import { countryCameraDistance, countryCurriculum, countryOptions } from './curriculum'
import { CountryGlobe, preloadCountryMap, type GlobePick } from './CountryGlobe'
import type { Country } from './curriculum'

const countryNamesById = new Map(countryCurriculum.map((country) => [country.id, country.name]))

/** Clicks this close to a small target's centre count, since it may be only a few pixels wide. */
const SMALL_TARGET_TOLERANCE_PX = 22

/** The name a locate click resolves to: the target when it was hit, else what was clicked. */
export function locateAnswer(target: Country, pick: GlobePick) {
  if (pick.countryId === target.id) return target.name
  const nearTarget = pick.pixelsFromTarget <= SMALL_TARGET_TOLERANCE_PX
  if (nearTarget && (target.showSmallCountryMarker || target.isIslandNation || !pick.countryId)) {
    return target.name
  }
  if (!pick.countryId) return 'open ocean'
  return countryNamesById.get(pick.countryId) ?? 'a disputed territory'
}

type CountriesQuizProps = {
  xp: number
  onEarnXp: (amount: number) => void
  onUpdateSafePoint: (safe: boolean) => void
}

export function CountriesQuiz({ xp, onEarnXp, onUpdateSafePoint }: CountriesQuizProps) {
  return (
    <LocationQuiz
      xp={xp}
      onEarnXp={onEarnXp}
      onUpdateSafePoint={onUpdateSafePoint}
      curriculum={countryCurriculum}
      storageKeys={{
        completions: 'geobam-country-multiple-choice-completions',
        performance: 'geobam-country-performance',
      }}
      copy={{
        fileLabel: 'File 001 · Countries',
        prompt: 'Which country is highlighted?',
        typedLabel: 'Enter registered country name',
        returnLabel: 'Return to country',
        roundCompleteBody:
          'Every country in this batch has been resolved. Your registry record now advances toward level {nextLevel}.',
        typedInputId: 'country-answer',
        locatePrompt: 'Find {name} on the globe',
        locateReturnLabel: 'Return to start',
      }}
      optionsFor={(country, { hard }) => countryOptions(country, Math.max(2, country.level), hard)}
      closeUps
      locateRounds
      preloadNext={(country) => preloadCountryMap(country.id, country.showIslandEnvelope)}
      renderGlobe={(country, resetSignal, onTargetPosition, { closeUp, locate, startFocus }, { submitAnswer, revealed }) => (
        <CountryGlobe
          countryId={country.id}
          countryName={locate ? country.name : 'the mystery country'}
          focus={country.focus}
          showSmallCountryMarker={country.showSmallCountryMarker && (!locate || revealed)}
          isIslandNation={country.isIslandNation}
          showIslandEnvelope={country.showIslandEnvelope}
          highlightCountry={!locate || revealed}
          startFocus={startFocus}
          onPick={locate ? (pick) => submitAnswer(locateAnswer(country, pick)) : undefined}
          cameraDistance={countryCameraDistance(country, closeUp)}
          lockZoom={closeUp > 0}
          resetSignal={resetSignal}
          onTargetPosition={onTargetPosition}
        />
      )}
    />
  )
}
