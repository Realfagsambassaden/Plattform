#!/usr/bin/env python3
"""Spørsmålsbank, første omgang: mekanikk og elektrisitet.
Bruk: python3 verktoy/sporsmal/lag_bank.py tema.yml studie/sporsmal.json
Felter: tema og undertema = id-ene i tema.yml (samme struktur som nettsiden).
Feilsvar merkes r| (riktig tanke, regnefeil: gir presisjon) eller b| (begrepsfeil: gir forståelse).
ck = fasit utregnet i kode, i samme enhet som svaret."""
import json, re, sys
from math import sqrt, pi, sin, cos, tan, atan, radians, degrees
import yaml

g = 9.81; G = 6.67e-11; ME = 5.97e24; RE = 6.37e6; k = 8.99e9; e = 1.60e-19; me = 9.11e-31; mp = 1.67e-27
B = []
L, M, V = "lett", "middels", "vanskelig"
T = None
def tema(t):
    global T; T = t
def q(d, niv, sek, tekst, riktig, feil, forkl, ck=None):
    B.append(dict(id=f"{T}-{len(B)+1:03d}", tema=T, undertema=d, vanskelighet=niv, forventet_tid_s=sek,
                  tekst=tekst, riktig=riktig,
                  feil=[dict(svar=f[2:], type={"r": "regnefeil", "b": "begrep"}[f[0]]) for f in feil],
                  forklaring=forkl, ck=ck))

tema("kinematikk")
d = "posisjon-fart-akselerasjon"
q(d,L,40,"En bil kjører 150 km på 2.0 h. Hva er gjennomsnittsfarten?","75 km/h",["r|300 km/h","r|7.5 km/h","b|150 km/h"],"$v = s/t = 150\\ \\mathrm{km} / 2.0\\ \\mathrm{h}$.",150/2)
q(d,L,20,"Hva forteller stigningstallet i en graf av fart mot tid?","Akselerasjonen",["b|Strekningen","b|Farten","b|Tiden"],"Stigningstallet er endring i fart per tid, og det er akselerasjonen.")
d = "konstant-akselerasjon"
q(d,L,40,"En vogn starter fra ro og har akselerasjonen 2.0 m/s² i 5.0 s. Hva er farten etterpå?","10 m/s",["r|25 m/s","b|2.0 m/s","b|7.0 m/s"],"$v = at = 2.0\\cdot 5.0\\ \\mathrm{m/s}$.",2*5)
q(d,M,90,"En stein slippes fra 20 m høyde. Hvor lang tid tar fallet uten luftmotstand?","2.0 s",["r|4.1 s","r|1.4 s","r|0.49 s"],"$t = \\sqrt{2h/\\mathrm{g}}$.",sqrt(2*20/g))
q(d,M,90,"En bil som kjører i 20 m/s, bremser med 4.0 m/s². Hvor lang er bremselengden?","50 m",["r|100 m","r|5.0 m","b|80 m"],"$s = v_0^2/(2a) = 400/8.0\\ \\mathrm{m}$.",400/8)
q(d,V,180,"En bil holder 30 m/s og passerer en politibil som står stille. Politibilen akselererer straks med 3.0 m/s². Hvor lang tid tar det før den tar igjen bilen?","20 s",["b|10 s","r|40 s","r|15 s"],"Samme strekning: $30t = \\frac{1}{2}\\cdot 3.0\\ t^2$. Etter 10 s har de bare samme fart.",2*30/3)
d = "to-dimensjoner"
q(d,M,40,"En ball kastes horisontalt. Hva skjer med den horisontale farten uten luftmotstand?","Den er konstant",["b|Den øker","b|Den avtar","b|Den blir null når ballen faller"],"Ingen kraft virker horisontalt, så det er ingen akselerasjon i den retningen.")
q(d,V,150,"En ball kastes med 20 m/s i 30° over horisontalen fra flatt underlag. Hvor lenge er den i lufta?","2.0 s",["r|1.0 s","r|3.5 s","b|4.1 s"],"$t = 2v_0\\sin\\theta/\\mathrm{g}$.",2*20*sin(radians(30))/g)
q(d,V,180,"En ball kastes horisontalt med 8.0 m/s fra 5.0 m høyde. Hvor langt unna lander den, målt horisontalt?","8.1 m",["r|5.7 m","r|16 m","b|40 m"],"$t = \\sqrt{2h/\\mathrm{g}}$ og $x = v_0 t$.",8*sqrt(10/g))

tema("sirkelbevegelse")
d = "sentripetal"
q(d,L,20,"Et legeme går i jevn sirkelbevegelse. Hvilken retning har akselerasjonen?","Inn mot sentrum",["b|I fartsretningen","b|Ut fra sentrum","b|Den er null fordi farten er konstant"],"Fartsretningen endrer seg hele tiden, og akselerasjonen peker mot sentrum.")
q(d,L,40,"Et legeme har farten 10 m/s i en sirkel med radius 5.0 m. Hva er sentripetalakselerasjonen?","20 m/s²",["r|2.0 m/s²","r|50 m/s²","b|0 m/s²"],"$a = v^2/r$.",100/5)
q(d,M,90,"En kule går rundt i en sirkel med radius 0.50 m og perioden 2.0 s. Hva er banefarten?","1.6 m/s",["r|3.1 m/s","r|0.79 m/s","b|0.25 m/s"],"$v = 2\\pi r/T$.",2*pi*.5/2)
d = "sirkel-krefter"
q(d,L,30,"Hvilken kraft gir sentripetalkraften når en bil svinger på en flat vei?","Friksjonen mellom dekk og vei",["b|Tyngdekraften","b|Normalkraften","b|En egen sentrifugalkraft"],"Bare friksjonen virker horisontalt inn mot sentrum av svingen.")
q(d,M,90,"En bil på 1200 kg kjører i 20 m/s gjennom en sving med radius 80 m. Hvor stor sentripetalkraft trengs?","6.0 kN",["r|0.30 kN","r|12 kN","b|Ingen, fordi farten er konstant"],"$F = mv^2/r$.",1200*400/80/1000)
q(d,M,40,"En bil kjører over en bakketopp. Hvordan er normalkraften sammenliknet med tyngden på toppen?","Mindre enn tyngden",["b|Større enn tyngden","b|Lik tyngden","b|Alltid null"],"Summen av kreftene må peke nedover mot sentrum, så $G > N$.")
q(d,V,150,"En bøtte svinges i en loddrett sirkel med radius 1.0 m. Hva er minste fart på toppen for at vannet skal bli i bøtta?","3.1 m/s",["r|9.8 m/s","r|4.4 m/s","b|0 m/s"],"På grensen er $N = 0$, så $m\\mathrm{g} = mv^2/r$.",sqrt(g))
q(d,V,180,"En flat sving har radius 50 m, og det statiske friksjonstallet er 0.60. Hva er største fart uten å skli?","17 m/s",["r|29 m/s","r|24 m/s","b|Kan ikke beregnes uten massen"],"$\\mu_s m\\mathrm{g} = mv^2/r$, og massen forkortes.",sqrt(.6*g*50))
q(d,V,180,"En friksjonsfri, dosert sving har radius 100 m og er laget for 20 m/s. Hvilken doseringsvinkel trengs?","22°",["r|68°","r|24°","b|0°"],"$\\tan\\theta = v^2/(r\\mathrm{g})$.",degrees(atan(400/(100*g))))

tema("newtons-lover")
d = "newtons-lover"
q(d,L,20,"Et legeme beveger seg med konstant fart i rett linje. Hva er summen av kreftene?","Null",["b|Større enn null i fartsretningen","b|Lik tyngden","b|Lik masse ganger fart"],"Newtons 1. lov: uten akselerasjon er kraftsummen null.")
q(d,L,30,"Et legeme på 5.0 kg påvirkes av en kraftsum på 10 N. Hva er akselerasjonen?","2.0 m/s²",["r|50 m/s²","r|0.50 m/s²","b|10 m/s²"],"$a = F/m$.",10/5)
q(d,M,30,"Jorda trekker på et eple. Hvordan er eplets kraft på Jorda sammenliknet med det?","Like stor, motsatt rettet",["b|Mye mindre","b|Mye større","b|Eplet trekker ikke på Jorda"],"Newtons 3. lov gjelder uansett masse.")
d = "krefter-i-planet"
q(d,M,90,"En kloss glir på et friksjonsfritt skråplan med vinkel 30°. Hva er akselerasjonen?","4.9 m/s²",["r|8.5 m/s²","r|2.5 m/s²","b|9.8 m/s²"],"$a = \\mathrm{g}\\sin\\theta$.",g*.5)
q(d,V,180,"En kloss glir ned et skråplan med vinkel 30°, og $\\mu_k = 0.20$. Hva er akselerasjonen?","3.2 m/s²",["r|2.9 m/s²","r|6.6 m/s²","b|4.9 m/s²"],"$a = \\mathrm{g}(\\sin\\theta - \\mu_k\\cos\\theta)$.",g*(.5-.2*cos(radians(30))))
d = "friksjon-fjaer-snorer"
q(d,L,30,"En fjær med stivhet 200 N/m strekkes 0.10 m. Hva er fjærkraften?","20 N",["r|2.0 kN","r|2.0 N","b|200 N"],"$F = kx$.",200*.1)
q(d,M,90,"En kasse på 10 kg glir på et horisontalt golv med $\\mu_k = 0.30$. Hvor stor er friksjonskraften?","29 N",["r|3.0 N","r|33 N","b|98 N"],"$f = \\mu_k m\\mathrm{g}$.",.3*10*g)
q(d,V,180,"Lodd på 3.0 kg og 1.0 kg henger i hver sin ende av en snor over en lett, friksjonsfri trinse. Hva er snordraget?","15 N",["r|7.4 N","b|9.8 N","b|29 N"],"$a = \\mathrm{g}/2$, og $S = 1.0\\ \\mathrm{kg}\\cdot(\\mathrm{g}+a)$.",1*(g+g/2))
d = "luftmotstand"
q(d,V,180,"En fallskjermhopper på 80 kg har luftmotstanden $L = kv^2$ med $k = 0.25$ kg/m. Hva er terminalfarten?","56 m/s",["r|40 m/s","r|3.1 km/s","b|Farten øker uten grense"],"Ved terminalfart er $kv^2 = m\\mathrm{g}$.",sqrt(80*g/.25))

tema("bevegelsesmengde")
d = "kraftstot"
q(d,L,30,"Hva er bevegelsesmengden til et legeme på 2.0 kg med farten 3.0 m/s?","6.0 kg m/s",["r|1.5 kg m/s","r|9.0 kg m/s","b|5.0 kg m/s"],"$p = mv$.",2*3)
q(d,L,30,"En kraft på 10 N virker i 3.0 s. Hvor stort er kraftstøtet?","30 N s",["r|3.3 N s","r|0.30 kN s","b|13 N s"],"$I = Ft$.",10*3)
q(d,M,90,"En ball på 0.15 kg med farten 20 m/s stoppes på 0.010 s. Hvor stor er middelkraften?","0.30 kN",["r|30 N","r|3.0 kN","b|3.0 kg m/s"],"$F = \\Delta p/\\Delta t$.",.15*20/.01/1000)
d = "kollisjoner"
q(d,L,20,"Hva er alltid bevart i et støt i et isolert system?","Bevegelsesmengden",["b|Den kinetiske energien","b|Farten til hvert legeme","b|Bevegelsesmengden til hvert legeme"],"Indre krefter endrer ikke den samlede bevegelsesmengden.")
q(d,M,90,"En vogn på 2.0 kg med farten 4.0 m/s treffer en vogn på 2.0 kg i ro, og de henger sammen. Hva er farten etterpå?","2.0 m/s",["r|4.0 m/s","r|8.0 m/s","b|0 m/s"],"$mv = (m+m)V$.",2*4/4)
q(d,M,40,"To like kuler støter elastisk og sentralt, og den ene ligger i ro. Hva skjer?","Den første stopper, den andre får farten",["b|Begge fortsetter med halv fart","b|Den første spretter tilbake med samme fart","b|Begge stopper"],"Bevegelsesmengde og kinetisk energi er bevart bare med denne løsningen.")
q(d,V,150,"En vogn på 2.0 kg med farten 4.0 m/s treffer en vogn på 2.0 kg i ro, og de henger sammen. Hvor mye kinetisk energi går tapt?","8.0 J",["r|16 J","r|4.0 J","b|0 J"],"Før: 16 J. Etter: $\\frac{1}{2}\\cdot 4.0\\cdot 2.0^2 = 8.0\\ \\mathrm{J}$.",16-.5*4*4)
q(d,V,150,"Et gevær på 4.0 kg skyter ut en kule på 10 g med farten 400 m/s. Hva er rekylfarten?","1.0 m/s",["r|1.0 km/s","r|0.10 m/s","b|0 m/s"],"$MV = mv$, med $m = 0.010\\ \\mathrm{kg}$.",.01*400/4)
q(d,V,180,"Et legeme på 3.0 kg med 4.0 m/s mot øst og et på 1.0 kg med 12 m/s mot nord støter og henger sammen. Hva er farten etterpå?","4.2 m/s",["r|6.0 m/s","r|17 m/s","b|0 m/s"],"Begge har 12 kg m/s, vinkelrett på hverandre: $p = \\sqrt{12^2+12^2}$, og $V = p/4.0$.",sqrt(288)/4)

tema("arbeid-og-energi")
d = "arbeid"
q(d,L,30,"En kraft på 20 N flytter en kasse 3.0 m i kraftens retning. Hvor stort er arbeidet?","60 J",["r|6.7 J","b|23 J","b|0 J"],"$W = Fs$.",20*3)
q(d,M,90,"En kraft på 50 N virker 60° på bevegelsesretningen over 10 m. Hvor stort er arbeidet?","0.25 kJ",["r|0.43 kJ","r|25 J","b|0.50 kJ"],"$W = Fs\\cos\\theta$.",50*10*.5/1000)
d = "energiformer"
q(d,L,30,"Hva er den kinetiske energien til et legeme på 2.0 kg med farten 3.0 m/s?","9.0 J",["r|18 J","r|3.0 J","b|6.0 J"],"$E_k = \\frac{1}{2}mv^2$.",.5*2*9)
q(d,M,30,"Farten til en bil dobles. Hvor mange ganger større blir den kinetiske energien?","4 ganger",["r|8 ganger","b|2 ganger","b|Den er uendret"],"$E_k$ er proporsjonal med $v^2$.",4)
d = "energibevaring"
q(d,M,90,"En kloss slippes og faller 5.0 m uten luftmotstand. Hva er farten nederst?","9.9 m/s",["r|7.0 m/s","r|98 m/s","b|Kan ikke beregnes uten massen"],"$m\\mathrm{g}h = \\frac{1}{2}mv^2$, og massen forkortes.",sqrt(2*g*5))
q(d,V,180,"En kjelke på 20 kg starter fra ro 10 m over bunnen og har farten 12 m/s nederst. Hvor mye mekanisk energi er tapt?","0.52 kJ",["r|1.4 kJ","r|3.4 kJ","b|0 J"],"Tap $= m\\mathrm{g}h - \\frac{1}{2}mv^2$.",(20*g*10-.5*20*144)/1000)
q(d,V,180,"En fjær med stivhet 500 N/m er presset sammen 0.20 m og skyter ut en kloss på 0.50 kg. Hva er utgangsfarten?","6.3 m/s",["r|4.5 m/s","r|40 m/s","b|20 m/s"],"$\\frac{1}{2}kx^2 = \\frac{1}{2}mv^2$.",sqrt(500*.04/.5))
d = "effekt"
q(d,L,30,"En motor gjør et arbeid på 0.60 kJ på 20 s. Hva er effekten?","30 W",["r|12 kW","r|0.033 W","b|0.60 kW"],"$P = W/t$.",600/20)
q(d,V,180,"En kran med virkningsgrad 75 % løfter 500 kg opp 12 m på 30 s. Hvor stor effekt må tilføres?","2.6 kW",["r|2.0 kW","r|1.5 kW","b|4.9 kW"],"$P = m\\mathrm{g}h/(t\\eta)$.",500*g*12/30/.75/1000)

tema("statikk")
d = "kraftlikevekt"
q(d,L,20,"Hva kreves for at et stivt legeme skal være i likevekt?","Både kraftsummen og momentsummen er null",["b|Bare at kraftsummen er null","b|Bare at momentsummen er null","b|At tyngden er null"],"Kraftsummen hindrer forflytning, momentsummen hindrer rotasjon.")
q(d,M,120,"En lampe på 5.0 kg henger i to snorer som begge danner 30° med loddlinjen. Hva er kraften i hver snor?","28 N",["r|25 N","r|49 N","r|57 N"],"$2S\\cos 30° = m\\mathrm{g}$.",5*g/(2*cos(radians(30))))
d = "kraftmoment"
q(d,L,30,"En kraft på 20 N virker vinkelrett på en arm med lengde 0.50 m. Hvor stort er kraftmomentet?","10 N m",["r|40 N m","r|2.5 N m","b|20 N m"],"$\\tau = Fr$.",20*.5)
q(d,M,90,"Et barn på 30 kg sitter 2.0 m fra vippepunktet. Hvor langt fra vippepunktet må et barn på 40 kg sitte på den andre siden?","1.5 m",["r|2.7 m","r|1.0 m","b|2.0 m"],"$m_1 r_1 = m_2 r_2$.",30*2/40)
q(d,V,180,"En jevn bjelke på 20 kg og 4.0 m hviler på støtter i begge ender, A og B. En person på 60 kg står 1.0 m fra A. Hvor stor er kraften fra støtten i B?","0.25 kN",["r|0.54 kN","r|0.15 kN","b|0.39 kN"],"Moment om A: $4.0 N_B = (20\\cdot 2.0 + 60\\cdot 1.0)\\mathrm{g}$.",(20*2+60)/4*g/1000)
q(d,V,180,"En lett bom er hengslet i veggen. I enden henger 10 kg, og en snor fra enden til veggen danner 30° med bommen. Hva er snordraget?","0.20 kN",["r|0.11 kN","r|49 N","b|98 N"],"Moment om hengslet: $S\\sin 30° = m\\mathrm{g}$.",10*g/.5/1000)
d = "massesenter"
q(d,L,30,"To like masser ligger i $x = 0$ og $x = 2.0$ m. Hvor er massesenteret?","1.0 m",["r|2.0 m","r|0.50 m","b|0 m"],"Med like masser ligger det midt mellom dem.",1)
q(d,M,90,"En masse på 1.0 kg ligger i $x = 0$ og en på 3.0 kg i $x = 4.0$ m. Hvor er massesenteret?","3.0 m",["r|1.0 m","r|12 m","b|2.0 m"],"$x = (1.0\\cdot 0 + 3.0\\cdot 4.0)/4.0$.",12/4)
q(d,V,150,"En jevn stav på 2.0 kg og 1.0 m har en masse på 1.0 kg festet i høyre ende. Hvor langt fra venstre ende er massesenteret?","0.67 m",["r|0.33 m","r|0.75 m","b|0.50 m"],"$x = (2.0\\cdot 0.50 + 1.0\\cdot 1.0)/3.0$.",2/3)

tema("rotasjon")
d = "rotasjonskinematikk"
q(d,L,40,"Et hjul roterer 2.0 omdreininger per sekund. Hva er vinkelfarten?","13 rad/s",["r|6.3 rad/s","r|3.1 rad/s","b|2.0 rad/s"],"$\\omega = 2\\pi f$.",4*pi)
q(d,M,90,"Et hjul starter fra ro med vinkelakselerasjonen 2.0 rad/s². Hvor stor vinkel dreier det på 5.0 s?","25 rad",["r|50 rad","r|5.0 rad","b|10 rad"],"$\\theta = \\frac{1}{2}\\alpha t^2$.",.5*2*25)
d = "treghetsmoment"
q(d,L,30,"En punktmasse på 2.0 kg går i en sirkel med radius 3.0 m. Hva er treghetsmomentet?","18 kg m²",["r|12 kg m²","r|36 kg m²","b|6.0 kg m²"],"$I = mr^2$.",2*9)
q(d,M,120,"En kompakt sylinder ($I = \\frac{1}{2}MR^2$) med $M = 4.0$ kg og $R = 0.50$ m roterer om aksen sin med 10 rad/s. Hva er rotasjonsenergien?","25 J",["r|5.0 J","r|13 J","b|50 J"],"$E = \\frac{1}{2}I\\omega^2$ med $I = 0.50\\ \\mathrm{kg\\ m^2}$.",.5*.5*100)
d = "rulling"
q(d,M,60,"Et legeme med treghetsmoment 2.0 kg m² får kraftmomentet 6.0 N m. Hva er vinkelakselerasjonen?","3.0 rad/s²",["r|12 rad/s²","r|0.33 rad/s²","b|6.0 rad/s²"],"$\\tau = I\\alpha$.",6/2)
q(d,V,180,"En kompakt sylinder ruller uten å skli ned fra høyden 2.0 m, fra ro. Hva er farten nederst?","5.1 m/s",["r|4.4 m/s","b|6.3 m/s","b|5.3 m/s"],"$m\\mathrm{g}h = \\frac{3}{4}mv^2$. Rotasjonen tar sin del av energien.",sqrt(4*g*2/3))
q(d,V,180,"Et lodd på 2.0 kg henger i en snor rundt en trinse formet som en kompakt skive på 4.0 kg. Hva er akselerasjonen til loddet?","4.9 m/s²",["r|3.3 m/s²","r|2.5 m/s²","b|9.8 m/s²"],"$a = m\\mathrm{g}/(m + M/2)$.",2*g/(2+2))
d = "dreieimpuls"
q(d,L,20,"En kunstløper trekker armene inn under en piruett. Hva skjer med vinkelfarten?","Den øker",["b|Den avtar","b|Den er uendret","b|Den blir null"],"Dreieimpulsen $L = I\\omega$ er bevart, og $I$ blir mindre.")
q(d,V,150,"Treghetsmomentet til en roterende person minker fra 4.0 til 1.0 kg m² uten ytre moment. Hvor mange ganger større blir rotasjonsenergien?","4 ganger",["r|2 ganger","r|16 ganger","b|Den er uendret"],"$\\omega$ blir firedoblet. $E = L^2/(2I)$ gir faktoren 4.",(.5*1*8**2)/(.5*4*2**2))

tema("gravitasjon")
d = "gravitasjonsloven"
q(d,L,30,"Avstanden mellom to masser dobles. Hva skjer med gravitasjonskraften?","Den blir en firedel",["b|Den blir halvert","r|Den blir doblet","b|Den er uendret"],"Kraften er omvendt proporsjonal med avstanden i andre.")
q(d,L,20,"Hva skjer med massen din hvis du reiser til Månen?","Den er uendret",["b|Den blir en sjettedel","b|Den blir null","b|Den dobles"],"Massen er den samme, mens tyngden endres.")
q(d,M,90,"To masser på 1.0·10³ kg ligger 1.0 m fra hverandre. Hvor stor er gravitasjonskraften?","67 µN",["r|67 nN","r|6.7 mN","b|9.8 kN"],"$F = \\mathrm{G}m_1 m_2/r^2$.",G*1e6/1e-6)
q(d,M,60,"Hva er tyngdeakselerasjonen i en høyde over bakken lik Jordas radius? Ved overflaten er den 9.81 m/s².","2.45 m/s²",["r|4.91 m/s²","r|1.09 m/s²","b|9.81 m/s²"],"Avstanden fra sentrum dobles, så verdien blir en firedel.",g/4)
q(d,V,180,"Hva er unnslipningsfarten fra Jordas overflate? Bruk $M = 5.97\\cdot 10^{24}$ kg og $R = 6.37\\cdot 10^6$ m.","11.2 km/s",["r|5.6 km/s","r|16 km/s","b|7.9 km/s"],"$v = \\sqrt{2\\mathrm{G}M/R}$. Sirkelbanefarten ved overflaten er 7.9 km/s.",sqrt(2*G*ME/RE)/1000)
d = "satellitter"
q(d,L,20,"Hva holder en satellitt i bane rundt Jorda?","Gravitasjonen",["b|Motoren til satellitten","b|En sentrifugalkraft","b|Det virker ingen krefter"],"Gravitasjonen er sentripetalkraften i banen.")
q(d,M,120,"En satellitt går i sirkelbane med radius 7.0·10⁶ m rundt Jorda ($M = 5.97\\cdot 10^{24}$ kg). Hva er banefarten?","7.5 km/s",["r|11 km/s","r|3.8 km/s","b|Avhenger av massen til satellitten"],"$v = \\sqrt{\\mathrm{G}M/r}$.",sqrt(G*ME/7e6)/1000)
q(d,V,60,"Baneradien til en satellitt firedobles. Hvor mange ganger lengre blir perioden?","8 ganger",["r|4 ganger","r|16 ganger","b|2 ganger"],"Keplers 3. lov: $T^2$ er proporsjonal med $r^3$.",4**1.5)
q(d,V,180,"Hva er baneradien, målt fra Jordas sentrum, for en satellitt med perioden 24 h? Bruk $M = 5.97\\cdot 10^{24}$ kg.","42 Mm",["r|6.4 Mm","r|9.5 Mm","b|36 Mm"],"$r^3 = \\mathrm{G}MT^2/(4\\pi^2)$. 36 Mm er høyden over bakken.",(G*ME*86400**2/(4*pi**2))**(1/3)/1e6)

tema("svingninger")
d = "harmoniske"
q(d,L,30,"En svingning har perioden 0.50 s. Hva er frekvensen?","2.0 Hz",["r|0.50 Hz","r|4.0 Hz","b|1.0 Hz"],"$f = 1/T$.",1/.5)
q(d,L,20,"Hvor i en harmonisk svingning er farten størst?","I likevektsstillingen",["b|I ytterpunktene","b|Den er lik overalt","b|Halvveis ut mot ytterpunktene"],"I likevektsstillingen er all energi kinetisk.")
q(d,M,90,"En svingning har amplitude 0.10 m og vinkelfrekvens 5.0 rad/s. Hva er største fart?","0.50 m/s",["r|2.5 m/s","r|0.020 m/s","b|0.10 m/s"],"$v_{\\text{maks}} = A\\omega$.",.1*5)
q(d,V,150,"En svingning har amplitude 0.020 m og frekvens 5.0 Hz. Hva er største akselerasjon?","20 m/s²",["r|0.63 m/s²","r|0.50 m/s²","b|9.8 m/s²"],"$a_{\\text{maks}} = A\\omega^2$ med $\\omega = 2\\pi f$.",.02*(2*pi*5)**2)
q(d,V,180,"En kloss på 0.20 kg svinger i en fjær med stivhet 80 N/m og amplitude 0.050 m. Hva er farten når utsvinget er 0.030 m?","0.80 m/s",["r|1.0 m/s","r|0.60 m/s","b|0 m/s"],"$v = \\omega\\sqrt{A^2 - x^2}$ med $\\omega = \\sqrt{k/m} = 20\\ \\mathrm{rad/s}$.",sqrt(80/.2)*sqrt(.05**2-.03**2))
d = "pendel"
q(d,L,20,"Hva påvirker ikke perioden til en matematisk pendel ved små utslag?","Massen til loddet",["b|Lengden på snora","b|Tyngdeakselerasjonen","b|Alle disse påvirker perioden"],"$T = 2\\pi\\sqrt{l/\\mathrm{g}}$ inneholder ikke massen.")
q(d,M,90,"Hva er perioden til en pendel med lengde 1.00 m?","2.01 s",["r|6.28 s","r|0.50 s","b|9.81 s"],"$T = 2\\pi\\sqrt{l/\\mathrm{g}}$.",2*pi*sqrt(1/g))
q(d,M,90,"En kloss på 0.50 kg henger i en fjær med stivhet 200 N/m. Hva er perioden?","0.31 s",["r|0.050 s","r|20 s","b|0.16 s"],"$T = 2\\pi\\sqrt{m/k}$.",2*pi*sqrt(.5/200))
q(d,V,150,"En pendel med lengde 1.0 m har perioden 3.0 s på en fremmed planet. Hva er tyngdeakselerasjonen der?","4.4 m/s²",["r|1.1 m/s²","r|13 m/s²","b|9.8 m/s²"],"$\\mathrm{g} = 4\\pi^2 l/T^2$.",4*pi**2/9)

tema("elektrisk-felt")
d = "ladning"
q(d,L,20,"To positive ladninger ligger nær hverandre. Hva skjer?","De frastøter hverandre",["b|De tiltrekker hverandre","b|Det virker ingen kraft","b|Det avhenger av massene"],"Like ladninger frastøter hverandre.")
q(d,L,40,"Et legeme har ladningen −1.6·10⁻¹⁸ C. Hvor mange overskuddselektroner har det?","10",["r|100","r|0.10","b|1"],"$n = Q/\\mathrm{e}$.",1.6e-18/e)
d = "coulomb"
q(d,M,120,"To ladninger på 2.0 µC og 3.0 µC ligger 0.30 m fra hverandre. Hvor stor er kraften?","0.60 N",["r|0.18 N","r|6.0·10¹¹ N","b|0 N"],"$F = \\mathrm{k_e}q_1 q_2/r^2$.",k*6e-12/.09)
q(d,V,180,"En ladning $q$ ligger i $x = 0$ og en ladning $4q$ i $x = 3.0$ m. Hvor mellom dem blir kraften på en tredje ladning null?","1.0 m",["r|2.0 m","r|0.75 m","b|1.5 m"],"$1/x^2 = 4/(3.0-x)^2$ gir $3.0 - x = 2x$.",1)
d = "felt"
q(d,L,20,"Hvilken retning har det elektriske feltet rundt en positiv punktladning?","Bort fra ladningen",["b|Inn mot ladningen","b|I sirkler rundt ladningen","b|Det avhenger av testladningens fortegn"],"Feltet viser retningen på kraften på en positiv testladning.")
q(d,M,60,"En ladning på 2.0 nC er i et elektrisk felt på 500 N/C. Hvor stor er kraften?","1.0 µN",["r|1.0 mN","r|250 nN","b|500 N"],"$F = qE$.",2e-9*500/1e-6)
q(d,V,180,"Ladninger på +1.0 nC og −1.0 nC ligger 0.20 m fra hverandre. Hvor sterkt er feltet midt mellom dem?","1.8 kN/C",["r|0.90 kN/C","r|0.45 kN/C","b|0 N/C"],"Feltene peker samme vei: $E = 2\\mathrm{k_e}q/r^2$ med $r = 0.10\\ \\mathrm{m}$.",2*k*1e-9/.01/1000)
d = "homogent-felt"
q(d,M,60,"To parallelle plater står 2.0 cm fra hverandre med spenningen 120 V. Hvor sterkt er feltet?","6.0 kV/m",["r|60 V/m","r|2.4 V/m","b|120 V/m"],"$E = U/d$ med $d = 0.020\\ \\mathrm{m}$.",120/.02/1000)
q(d,V,180,"Et elektron starter fra ro og akselereres gjennom 150 V. Hva er farten etterpå?","7.3 Mm/s",["r|5.1 Mm/s","r|5.3·10¹³ m/s","b|170 km/s"],"$\\mathrm{e}U = \\frac{1}{2}\\mathrm{m_e}v^2$.",sqrt(2*e*150/me)/1e6)

tema("elektrisk-potensial")
d = "potensiell-energi"
q(d,L,20,"Hvordan beveger en fri, positiv ladning seg i et elektrisk felt?","Fra høyt mot lavt potensial",["b|Fra lavt mot høyt potensial","b|Den forblir i ro","b|Alltid vinkelrett på feltet"],"Da minker den potensielle energien.")
q(d,M,120,"Ladninger på +2.0 nC og −3.0 nC ligger 10 cm fra hverandre. Hva er den potensielle energien?","−0.54 µJ",["r|−5.4 µJ","r|−0.054 µJ","b|+0.54 µJ"],"$U = \\mathrm{k_e}q_1 q_2/r$. Motsatte fortegn gir negativ energi.",k*(-6e-18)/.1/1e-6)
q(d,V,180,"Hvor stort arbeid trengs for å flytte 1.0 nC fra uendelig langt unna til 5.0 cm fra en ladning på 4.0 nC?","0.72 µJ",["r|14 µJ","r|0.36 µJ","b|0 J"],"$W = \\mathrm{k_e}q_1 q_2/r$.",k*4e-18/.05/1e-6)
d = "potensial"
q(d,L,30,"En ladning på 2.0 C flyttes gjennom 12 V. Hvor stort er arbeidet?","24 J",["r|6.0 J","r|0.17 J","b|14 J"],"$W = qU$.",2*12)
q(d,L,20,"Hva er elektrisk spenning?","Potensialforskjell mellom to punkter",["b|Ladning per tid","b|Motstand i en leder","b|Kraft per ladning"],"Spenning er forskjellen i potensial, altså energi per ladning.")
q(d,M,90,"Hva er potensialet 0.30 m fra en punktladning på 3.0 nC?","90 V",["r|0.30 kV","r|27 V","b|0 V"],"$V = \\mathrm{k_e}q/r$.",k*3e-9/.3)
q(d,M,40,"Et elektron akselereres gjennom 5.0 V. Hvor mye kinetisk energi får det?","5.0 eV",["r|8.0 eV","r|3.2 eV","b|1.6 eV"],"Én elementærladning gjennom 5.0 V gir 5.0 eV.",5)
q(d,V,60,"Ladninger på +2.0 nC og −2.0 nC ligger et stykke fra hverandre. Hva gjelder midt mellom dem?","Potensialet er null, feltet er ikke null",["b|Potensialet er ikke null, feltet er null","b|Begge er null","b|Ingen av dem er null"],"Potensial er skalar og summen blir null. Feltene er vektorer og peker samme vei.")
q(d,V,180,"Et proton starter fra ro og akselereres gjennom 2.0 kV. Hva er farten etterpå?","0.62 Mm/s",["r|0.44 Mm/s","r|0.20 Mm/s","b|27 Mm/s"],"$\\mathrm{e}U = \\frac{1}{2}\\mathrm{m_p}v^2$.",sqrt(2*e*2000/mp)/1e6)

tema("kretser")
d = "strom-spenning"
q(d,L,30,"En ladning på 6.0 C passerer et punkt på 3.0 s. Hva er strømmen?","2.0 A",["r|18 A","r|0.50 A","b|9.0 A"],"$I = Q/t$.",6/3)
d = "motstand"
q(d,L,30,"En motstand på 4.0 Ω kobles til 12 V. Hva er strømmen?","3.0 A",["r|48 A","r|0.33 A","b|16 A"],"$I = U/R$.",12/4)
q(d,M,60,"Motstander på 6.0 Ω og 3.0 Ω er parallellkoblet. Hva er resultantmotstanden?","2.0 Ω",["r|4.5 Ω","r|0.50 Ω","b|9.0 Ω"],"$1/R = 1/6.0 + 1/3.0$.",1/(1/6+1/3))
d = "kirchhoff"
q(d,M,60,"I et knutepunkt går 5.0 A og 2.0 A inn, og 3.0 A og strømmen $I$ ut. Hva er $I$?","4.0 A",["r|10 A","r|6.0 A","b|0 A"],"Sum inn er lik sum ut.",7-3)
q(d,V,240,"Et batteri på 10 V i serie med 2.0 Ω og et batteri på 4.0 V i serie med 2.0 Ω er koblet parallelt, med samme polaritet, over en motstand på 2.0 Ω. Hva er strømmen gjennom denne motstanden?","2.3 A",["r|3.5 A","r|1.2 A","b|7.0 A"],"Knutepunkt: $(10-V)/2.0 + (4.0-V)/2.0 = V/2.0$ gir $V = 4.67\\ \\mathrm{V}$.",(14/3)/2)
d = "emf"
q(d,M,90,"Et batteri har ems 12 V og indre resistans 0.50 Ω. Det kobles til en ytre motstand på 5.5 Ω. Hva er klemmespenningen?","11 V",["r|1.0 V","r|2.0 V","b|12 V"],"$I = 12/6.0 = 2.0\\ \\mathrm{A}$ og $U = \\varepsilon - rI$.",12-.5*2)
q(d,V,180,"Et batteri har ems 12 V og indre resistans 2.0 Ω. Hva er den største effekten det kan gi til en ytre motstand?","18 W",["r|36 W","r|9.0 W","b|72 W"],"Størst effekt når $R = r$: $P = \\varepsilon^2/(4r)$.",144/8)
d = "effekt"
q(d,L,30,"En ovn trekker 2.0 A ved 230 V. Hva er effekten?","0.46 kW",["r|0.12 kW","r|0.92 kW","b|0.23 kW"],"$P = UI$.",230*2/1000)
q(d,V,180,"En ovn gir 1.2 kW ved 230 V. Hva gir den ved 200 V, med samme motstand?","0.91 kW",["r|0.79 kW","b|1.0 kW","b|1.2 kW"],"$P = U^2/R$, så $P$ går som $U^2$.",1.2*(200/230)**2)

import os
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'mekanikk2.py'),encoding='utf8').read())

# ---------- kontroll og utskrift ----------
kart = yaml.safe_load(open(sys.argv[1]))
tre = {e["id"]: (o["id"], e["tittel"], {d["id"]: d["tittel"] for d in e.get("undertemaer", [])}) for o in kart["omrader"] for e in o["temaer"]}
feil = 0
sup = str.maketrans("⁰¹²³⁴⁵⁶⁷⁸⁹⁻", "0123456789-")
for x in B:
    if x["undertema"] not in tre[x["tema"]][2]: print("UKJENT UNDERTEMA", x["id"]); feil += 1
    alle = [x["riktig"]] + [f["svar"] for f in x["feil"]]
    if len(set(alle)) != 4: print("LIKE SVAR", x["id"], alle); feil += 1
    if re.search(r"\d,\d", x["tekst"] + x["riktig"] + x["forklaring"]): print("KOMMA", x["id"]); feil += 1
    if x["ck"] is not None:
        m = re.match(r"[−+]?(\d+)(\.(\d+))?", x["riktig"])
        vist = float(m.group(0).replace("−", "-")); halv = .5 * 10 ** -len(m.group(3) or "")
        if abs(x["ck"] - vist) > halv * 1.02:
            print("FASIT?", x["id"], x["riktig"], x["ck"]); feil += 1
    if not re.search(r"\$", x["forklaring"]) and x["ck"] is not None: pass
from collections import Counter
tekster = Counter(x["tekst"] for x in B)
for t, n in tekster.items():
    if n > 1: print("DUPLIKAT", t); feil += 1
for x in B:
    if not x["feil"] or len(x["feil"]) != 3: print("FEIL ANTALL", x["id"]); feil += 1
print(len(B), "spørsmål;", "feil:", feil)
for t in dict.fromkeys(x["tema"] for x in B):
    c = Counter(x["vanskelighet"] for x in B if x["tema"] == t)
    print(f"{t:22s}", c[L], c[M], c[V])
# katalog: alle temaer med undertemaer på nettsiden (fagbyggeren bygger fag av dem, også uten spørsmål ennå)
katalog = {e["id"]: dict(omrade=o["id"], tittel=e["tittel"], undertemaer={d["id"]: d["tittel"] for d in e.get("undertemaer", [])})
           for o in kart["omrader"] for e in o["temaer"] if e.get("undertemaer")}
ut = {"omrader": {o["id"]: o["tittel"] for o in kart["omrader"]}, "katalog": katalog, "struktur": {t: dict(omrade=tre[t][0], tittel=tre[t][1], undertemaer=tre[t][2]) for t in dict.fromkeys(x["tema"] for x in B)},
      "sporsmal": [{k: v for k, v in x.items() if k != "ck"} for x in B]}
json.dump(ut, open(sys.argv[2], "w"), ensure_ascii=False, indent=0)
