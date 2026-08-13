import { LocationQuiz } from '../shared/LocationQuiz'
import { CountryGlobe, preloadCountryMap } from '../countries/CountryGlobe'
import { capitalCurriculum, capitalMarkers, capitalOptions } from './curriculum'

type CapitalsQuizProps = {
  xp: number
  onEarnXp: (amount: number) => void
  onUpdateSafePoint: (safe: boolean) => void
}

export function CapitalsQuiz({ xp, onEarnXp, onUpdateSafePoint }: CapitalsQuizProps) {
  return (
    <LocationQuiz
      xp={xp}
      onEarnXp={onEarnXp}
      onUpdateSafePoint={onUpdateSafePoint}
      curriculum={capitalCurriculum}
      storageKeys={{
        completions: 'geobam-capital-multiple-choice-completions',
        performance: 'geobam-capital-performance',
      }}
      copy={{
        fileLabel: 'File 002 · Capital cities',
        prompt: 'Which capital city is marked?',
        typedLabel: 'Enter registered capital city',
        returnLabel: 'Return to city',
        roundCompleteBody:
          'Every capital in this batch has been resolved. Your registry record now advances toward level {nextLevel}.',
        typedInputId: 'capital-answer',
      }}
      optionsFor={(capital) => capitalOptions(capital, Math.max(2, capital.level))}
      preloadNext={(capital) => preloadCountryMap(
        capital.countryId,
        false,
        capital.highlightHostCountry,
      )}
      renderGlobe={(capital, resetSignal, onTargetPosition) => (
        <CountryGlobe
          countryId={capital.countryId}
          countryName="the mystery capital"
          focus={capital.focus}
          showSmallCountryMarker={false}
          isIslandNation={false}
          showIslandEnvelope={false}
          highlightCountry={capital.highlightHostCountry}
          markers={capitalMarkers(capital.id)}
          cameraDistance={5.6}
          resetSignal={resetSignal}
          onTargetPosition={onTargetPosition}
        />
      )}
    />
  )
}
