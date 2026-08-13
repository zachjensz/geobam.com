import { LocationQuiz } from '../shared/LocationQuiz'
import { countryCurriculum, countryOptions } from './curriculum'
import { CountryGlobe, preloadCountryMap } from './CountryGlobe'

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
      }}
      optionsFor={(country) => countryOptions(country, Math.max(2, country.level))}
      preloadNext={(country) => preloadCountryMap(country.id, country.showIslandEnvelope)}
      renderGlobe={(country, resetSignal, onTargetPosition) => (
        <CountryGlobe
          countryId={country.id}
          countryName="the mystery country"
          focus={country.focus}
          showSmallCountryMarker={country.showSmallCountryMarker}
          isIslandNation={country.isIslandNation}
          showIslandEnvelope={country.showIslandEnvelope}
          resetSignal={resetSignal}
          onTargetPosition={onTargetPosition}
        />
      )}
    />
  )
}
