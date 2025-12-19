# 熵值法

```jsx
********************定义求熵值程序********************
capture program drop shangzhi
program shangzhi
args var statue rn //var：待处理的变量statue=1表示正向指标,statue=-1表示负向指标, rn:r年与n个观测值的乘积
quietly{
*step1 归一化 `var'_sd
sum `var' 
scalar min=r(min)
scalar max=r(max)

g `var'_sd=(`var'-min)/(max-min)
if `statue'==-1{
noisily dis as error "负向指标"
replace `var'_sd=1-`var'_sd
}

*step2 计算占比 `var'_sdw
g  `var'_sds= `var'_sd+0.00000001 //注：添加偏移量0.00000001,可自行修改
egen `var'_sds_sum=sum(`var'_sds) //计算`var'_sds的总和
g  `var'_sdw=`var'_sds / `var'_sds_sum //计算`var'_sds的占比

*step3 计算熵值 `var'_s
g `var'_sij=-1*`var'_sdw*ln(`var'_sdw)/ln(`rn') //`var'_sij
egen `var'_s=sum(`var'_sij) //熵值`var'_s

*step4 计算信息效用 `var'_g
g `var'_g=1-`var'_s

*step5 清除多余变量:只保留`var'_sd，`var'_g
drop `var'_sds `var'_sdw `var'_sds_sum `var'_sij `var'_s 
}
end
***********************************
*****************主程序*************

*【1】求`var'_g
/*调用shangzhi程序，依次输入三个参数，
要处理的变量var,正向指标或者负向指标（1 or -1），r*n的数值（本文：14*30=420,14年，30个省市）
注：负向指标会提示文字，正向则不会*/

*注，以下代码可按需要修改

*负向指标
//shangzhi v1 -1 420
//shangzhi v3 -1 420
//shangzhi v5 -1 420
*正向指标
shangzhi cipin1 1 6699
shangzhi 无形资产智能制造 1 6699
shangzhi 固定资产智能制造 1 6699

*【2】求权重wi
g sum_g=cipin1_g+无形资产智能制造_g+固定资产智能制造_g //_g为信息效用值

gen w_cipin1=cipin1_g/sum_g
gen w_无形资产智能制造=无形资产智能制造_g/sum_g
gen w_固定资产智能制造=固定资产智能制造_g/sum_g

drop sum_g 
list w* in 1 //展示权重

*【3】求最终得分hij
g h=cipin1_sd*w_cipin1+无形资产智能制造_sd*w_无形资产智能制造+固定资产智能制造_sd*w_固定资产智能制造
drop *_g *_sd
save "D:\000我的办公区\硕士毕业\论文\数据-原始\panel\panel_h",replace
```

多变量

```diff
*****************主程序*************

*【1】求`var'_g
/*调用shangzhi程序，依次输入三个参数，
要处理的变量var,正向指标或者负向指标（1 or -1），r*n的数值（本文：14*30=420,14年，30个省市）
注：负向指标会提示文字，正向则不会*/

*注，以下代码可按需要修改

*负向指标
foreach v of varlist 收入贫困线 相对收入 恩格尔系数 医疗保健支出 身体功能 抑郁情况 生活满意度 电梯使用 洗澡 厕所 宽带上网 耐用品  {
	shangzhi `v' -1 34150
}

*【2】求权重wi
egen sum_g=rowtotal(*_g) //_g为信息效用值

foreach v of varlist 收入贫困线 相对收入 恩格尔系数 医疗保健支出 身体功能 抑郁情况 生活满意度 电梯使用 洗澡 厕所 宽带上网 耐用品 {
	gen w_`v'=`v'_g/sum_g
}

drop sum_g 
list w* in 1 //展示权重

*【3】求最终得分hij
gen h =0
foreach v of varlist 收入贫困线 相对收入 恩格尔系数 医疗保健支出 身体功能 抑郁情况 生活满意度 电梯使用 洗澡 厕所 宽带上网 耐用品 {
	replace h=`v'_sd*w_`v'+h
}

drop *_g *_sd
```