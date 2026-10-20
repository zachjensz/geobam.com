import { worldCountries } from '../../data/countriesSlim'
import and from 'world-countries/data/and.geo.json'
import atg from 'world-countries/data/atg.geo.json'
import bhr from 'world-countries/data/bhr.geo.json'
import bhs from 'world-countries/data/bhs.geo.json'
import brb from 'world-countries/data/brb.geo.json'
import brn from 'world-countries/data/brn.geo.json'
import bmu from 'world-countries/data/bmu.geo.json'
import com from 'world-countries/data/com.geo.json'
import cpv from 'world-countries/data/cpv.geo.json'
import cyp from 'world-countries/data/cyp.geo.json'
import dma from 'world-countries/data/dma.geo.json'
import fsm from 'world-countries/data/fsm.geo.json'
import gmb from 'world-countries/data/gmb.geo.json'
import grd from 'world-countries/data/grd.geo.json'
import jam from 'world-countries/data/jam.geo.json'
import kir from 'world-countries/data/kir.geo.json'
import kna from 'world-countries/data/kna.geo.json'
import lbn from 'world-countries/data/lbn.geo.json'
import lca from 'world-countries/data/lca.geo.json'
import lie from 'world-countries/data/lie.geo.json'
import lux from 'world-countries/data/lux.geo.json'
import mco from 'world-countries/data/mco.geo.json'
import mdv from 'world-countries/data/mdv.geo.json'
import mhl from 'world-countries/data/mhl.geo.json'
import mlt from 'world-countries/data/mlt.geo.json'
import mne from 'world-countries/data/mne.geo.json'
import mus from 'world-countries/data/mus.geo.json'
import nru from 'world-countries/data/nru.geo.json'
import plw from 'world-countries/data/plw.geo.json'
import pse from 'world-countries/data/pse.geo.json'
import qat from 'world-countries/data/qat.geo.json'
import sgp from 'world-countries/data/sgp.geo.json'
import smr from 'world-countries/data/smr.geo.json'
import stp from 'world-countries/data/stp.geo.json'
import syc from 'world-countries/data/syc.geo.json'
import tls from 'world-countries/data/tls.geo.json'
import ton from 'world-countries/data/ton.geo.json'
import tto from 'world-countries/data/tto.geo.json'
import tuv from 'world-countries/data/tuv.geo.json'
import vat from 'world-countries/data/vat.geo.json'
import vct from 'world-countries/data/vct.geo.json'
import vut from 'world-countries/data/vut.geo.json'
import wsm from 'world-countries/data/wsm.geo.json'

type DetailedGeometry =
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] }

type DetailedCollection = {
  features: Array<{ geometry: DetailedGeometry }>
}

const collections = {
  and, atg, bhr, bhs, bmu, brb, brn, com, cpv, cyp, dma, fsm, gmb, grd, jam,
  kir, kna, lbn, lca, lie, lux, mco, mdv, mhl, mlt, mne, mus, nru, plw,
  pse, qat, sgp, smr, stp, syc, tls, ton, tto, tuv, vat, vct, vut, wsm,
} as unknown as Record<string, DetailedCollection>

export const detailedCountryFeatures = Object.entries(collections).map(([code, collection]) => {
  const country = worldCountries.find((candidate) => candidate.cca3.toLowerCase() === code)
  return {
    id: country?.ccn3 ?? code,
    geometry: collection.features[0].geometry,
  }
})

export const detailedCountryIds = new Set(
  detailedCountryFeatures.map((mapFeature) => mapFeature.id),
)
