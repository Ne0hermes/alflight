# @alflight/calc-engine

Moteur de calcul d'ALFlight : masse & centrage, navigation, carburant, performances.

## Règles du paquet

**1. Aucune dépendance d'interface.** Ni React, ni store, ni `document`, ni `window`,
ni `localStorage`, ni `fetch`. Un module qui en a besoin ne rentre pas — il reste
dans l'application et appelle le moteur.

**2. Aucune entrée/sortie.** Les données arrivent en paramètres, les résultats
repartent en valeur de retour. Ce qui vient du réseau (vents en altitude,
déclinaison magnétique, élévation du terrain) est fourni par l'appelant sous
forme de fonction injectée — le patron est déjà pratiqué par `routeWindTimes`.

**3. Fail-closed.** Une donnée manquante ou une conversion impossible renvoie
`null` — jamais une valeur par défaut plausible. En préparation de vol, un
chiffre inventé est plus dangereux qu'une absence signalée.

**4. Unités canoniques** : masses en **kg**, bras en **m**, moments en **kg·m**,
carburant en **litres**, vitesses en **kt**, altitudes en **ft**, distances en **NM**.
La conversion vers les préférences du pilote se fait à l'affichage, jamais ici.

**5. Rien ne bouge sans test d'or.** Chaque module déplacé est d'abord caractérisé
par des tests qui figent son comportement actuel ; le déplacement n'est accepté
que si ces tests restent verts, à la valeur près.

## Organisation

```
src/
  units/   conversions et densités (pivot canonique)
  nav/     route, distances, caps, triangle des vents
  wb/      masse & centrage, enveloppe, bras
  fuel/    bilan carburant, réserves, autonomie
  perf/    performances, abaques, facteurs correctifs
```

## État

Vague 0 en cours : modules sans aucune dépendance. Les anciens chemins
(`src/utils/...`) restent valables — ils ré-exportent depuis le paquet, ce qui
permet de migrer les appelants progressivement sans jamais casser l'application.
