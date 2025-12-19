# PSM-DID

```r
*************核匹配
use "D:\000替补桌面\中德智能制造\数据\panel\panel_ate",clear
xtset stock_id year
winsor2 Y size grow pay age cash lev roe indratio dual numb wg, replace cuts(1 99)
global z "size grow pay age cash lev roe indratio dual numb wg"

psmatch2 treat $z, out(Y) logit ate kernel
pstest $z, both graph

drop if _support==0|_support==.

areg Y did  i.year, absorb(stock_id) r
est store psmkreg1
areg Y did $z i.year  , absorb(stock_id) r
est store psmKreg2
*************近邻匹配
use "D:\000替补桌面\中德智能制造\数据\panel\panel_ate",clear
xtset stock_id year
winsor2 Y size grow pay age cash lev roe indratio dual numb wg, replace cuts(1 99)
global z "size grow pay age cash lev roe indratio dual numb wg"

psmatch2 W $z, out(Y) logit ate neighbor(1)
pstest $z

drop if _support==0|_support==.

areg Y did  i.year, absorb(stock_id) r
est store psmnreg1
areg Y did $z i.year  , absorb(stock_id) r
est store psmnreg2

*************半径匹配
use "D:\000替补桌面\中德智能制造\数据\panel\panel_ate",clear
xtset stock_id year
winsor2 Y size grow pay age cash lev roe indratio dual numb wg, replace cuts(1 99)
global z "size grow pay age cash lev roe indratio dual numb wg"

psmatch2 W $z, out(Y) logit ate neighbor(2) caliper(0.05) ties 
pstest $z

drop if _support==0|_support==.

areg Y did  i.year, absorb(stock_id) r
est store psmrreg1
areg Y did $z i.year  , absorb(stock_id) r
est store psmrreg2

esttab psm* using "D:\000替补桌面\中德智能制造\数据\panel\表-PSM-DID.rtf",  r2 obslast  nogaps drop (*year*) star(* 0.1 ** 0.05  *** 0.01) b(%6.4f) se(%6.4f)  r2(%6.4f)  compress replace
```

# 逐年匹配

```diff
*****************************psm-did********************
***变量说明
*$x：表示协变量的全局暂元
*Y：被解释变量
*treated：处理组的虚拟变量

***第一步：逐年进行PSM，并将各年份PSM结果保存，最后获得1998年至2007年共10年的匹配后数据集
forvalue i = 1998/2007{
      preserve
          capture {
              keep if year == `i'
              set seed 0000
              gen  norvar_2 = rnormal()
              sort norvar_2

              psmatch2 treated $x , outcome(Y) logit neighbor(2)  ///
                                        ties common ate caliper(0.05)

              save `i'.dta, replace
              }
      restore
      }  

clear all

***第二步：纵向合并所有数据，将各年份匹配后数据纵向合并至一个数据集中，生成我们回归需要的面板数据
use 1998, clear
forvalue k =1999/2007 {
      capture {
          append using `k'.dta
          }
      }
save data, replace

***第三步：倾向得分值的核密度图
sum _pscore if treated == 1, detail  // 假设计算出的处理组的倾向得分均值为0.5698

*匹配前

sum _pscore if treated == 0, detail

twoway(kdensity _pscore if treated == 1, lpattern(solid)                     ///
              lcolor(black)                                                  ///
              lwidth(thin)                                                   ///
              scheme(qleanmono)                                              ///
              ytitle("{stSans:核}""{stSans:密}""{stSans:度}",                ///
                     size(medlarge) orientation(h))                          ///
              xtitle("{stSans:匹配前的倾向得分值}",                          ///
                     size(medlarge))                                         ///
              xline(0.5698   , lpattern(solid) lcolor(black))                ///
              xline(`r(mean)', lpattern(dash)  lcolor(black))                ///
              saving(kensity_yby_before, replace))                           ///
      (kdensity _pscore if treated == 0, lpattern(dash)),                    ///
      xlabel(     , labsize(medlarge) format(%02.1f))                        ///
      ylabel(0(1)3, labsize(medlarge))                                       ///
      legend(label(1 "{stSans:处理组}")                                      ///
             label(2 "{stSans:控制组}")                                      ///
             size(medlarge) position(1) symxsize(10))

graph export "kensity_yby_before.emf", replace

discard

*匹配后

sum _pscore if treated == 0 & _weight != ., detail

twoway(kdensity _pscore if treated == 1, lpattern(solid)                     ///
              lcolor(black)                                                  ///
              lwidth(thin)                                                   ///
              scheme(qleanmono)                                              ///
              ytitle("{stSans:核}""{stSans:密}""{stSans:度}",                ///
                     size(medlarge) orientation(h))                          ///
              xtitle("{stSans:匹配后的倾向得分值}",                          ///
                     size(medlarge))                                         ///
              xline(0.5698   , lpattern(solid) lcolor(black))                ///
              xline(`r(mean)', lpattern(dash)  lcolor(black))                ///
              saving(kensity_yby_after, replace))                            ///
      (kdensity _pscore if treated == 0 & _weight != ., lpattern(dash)),     ///
      xlabel(     , labsize(medlarge) format(%02.1f))                        ///
      ylabel(0(1)3, labsize(medlarge))                                       ///
      legend(label(1 "{stSans:处理组}")                                      ///
             label(2 "{stSans:控制组}")                                      ///
             size(medlarge) position(1) symxsize(10))

***第四步：逐年平衡性检验
*- 匹配前

forvalue i = 1998/2007 {
          capture {
              qui: logit treated $xlist i.ind3 if year == `i', vce(cluster prov)
              est store ybyb`i'
              }
          }

local ybyblist ybyb1998 ybyb1999 ybyb2000 ybyb2001 ybyb2002                  ///
               ybyb2003 ybyb2004 ybyb2005 ybyb2006 ybyb2007

reg2docx `ybyblist' using 逐年平衡性检验结果_匹配前.docx, b(%6.4f) t(%6.4f)  ///
         scalars(N r2_p(%6.4f)) noconstant replace                           ///
         indicate("Industry = *.ind3")                                       ///
         mtitles("1998b" "1999b" "2000b" "2001b" "2002b"                     ///
                 "2003b" "2004b" "2005b" "2006b" "2007b")                    ///
         title("逐年平衡性检验_匹配前")

*- 匹配后

forvalue i = 1998/2007 {
          capture {
              qui: logit treated $xlist i.ind3                               ///
                       if year == `i' & _weight != ., vce(cluster prov)
              est store ybya`i'
              }
          }

local ybyalist ybya1998 ybya1999 ybya2000 ybya2001 ybya2002                  ///
               ybya2003 ybya2004 ybya2005 ybya2006 ybya2007

reg2docx `ybyalist' using 逐年平衡性检验结果_匹配后.docx, b(%6.4f) t(%6.4f)  ///
         scalars(N r2_p(%6.4f)) noconstant replace                           ///
         indicate("Industry = *.ind3")                                       ///
         mtitles("1998a" "1999a" "2000a" "2001a" "2002a"                     ///
                 "2003a" "2004a" "2005a" "2006a" "2007a")                    ///
         title("逐年平衡性检验_匹配后")

```