# AI生成数据

生成数据：
任务完成时间排序为平台4＜平台3＜平台2＜平台1；屏幕眩晕感得分排序为平台4＜平台3＜平台1＜平台2；空间迷失感得分排序为平台3＜平台4＜平台2＜平台1；
空间能力越强，不同测试平台任务完成时间组间差值越小；VR熟悉程度越高，不同测试平台任务完成时间组间差值越小

```jsx
* 清空数据
clear

* 设置随机数种子以确保结果可重复
set seed 12345

* 生成21位被试者的ID
set obs 30
gen 被试序号 = _n

* 生成空间能力和VR熟悉程度
gen 空间能力 = round(runiform() * 10 + 10)
gen VR熟悉程度 = round(runiform() * 5 + 5)

* 生成任务完成时间，确保平台4 < 平台3 < 平台2 < 平台1
gen 任务完成时间4 = round(runiform() * 10 + 20)
gen 任务完成时间3 = 任务完成时间4 + round(runiform() * 5 + 5)
gen 任务完成时间2 = 任务完成时间3 + round(runiform() * 5 + 5)
gen 任务完成时间1 = 任务完成时间2 + round(runiform() * 5 + 5)

* 生成屏幕眩晕感得分，确保平台4 < 平台3 < 平台1 < 平台2
gen 屏幕眩晕4 = round(runiform() * 5 + 5)
gen 屏幕眩晕3 = 屏幕眩晕4 + round(runiform() * 2 + 1)
gen 屏幕眩晕1 = 屏幕眩晕3 + round(runiform() * 2 + 1)
gen 屏幕眩晕2 = 屏幕眩晕1 + round(runiform() * 2 + 1)

* 生成空间迷失感得分，确保平台3 < 平台4 < 平台2 < 平台1
gen 空间迷失3 = round(runiform() * 5 + 5)
gen 空间迷失4 = 空间迷失3 + round(runiform() * 2 + 1)
gen 空间迷失2 = 空间迷失4 + round(runiform() * 2 + 1)
gen 空间迷失1 = 空间迷失2 + round(runiform() * 2 + 1)

* 计算每行的任务完成时间的标准差
egen 任务完成时间标准差 = rowsd(任务完成时间1 任务完成时间2 任务完成时间3 任务完成时间4)

* 检查任务完成时间标准差与空间能力的相关系数
corr 任务完成时间标准差 空间能力
scalar corr_sa = r(rho)

* 检查任务完成时间标准差与VR熟悉程度的相关系数
corr 任务完成时间标准差 VR熟悉程度
scalar corr_vr = r(rho)

* 如果相关系数为正数，则调整任务完成时间
while corr_sa > 0 | corr_vr > 0 {
    forvalues i = 1/21 {
        scalar sa = 空间能力[`i']
        scalar vr = VR熟悉程度[`i']
        scalar factor = (sa + vr) / 2

        replace 任务完成时间4 = round(runiform() * 10 + 20) if _n == `i'
        replace 任务完成时间3 = 任务完成时间4 + round(runiform() * 5 + 5) / factor if _n == `i'
        replace 任务完成时间2 = 任务完成时间3 + round(runiform() * 5 + 5) / factor if _n == `i'
        replace 任务完成时间1 = 任务完成时间2 + round(runiform() * 5 + 5) / factor if _n == `i'
    }

    * 删除并重新计算每行的任务完成时间的标准差
    drop 任务完成时间标准差
    egen 任务完成时间标准差 = rowsd(任务完成时间1 任务完成时间2 任务完成时间3 任务完成时间4)

    * 重新检查任务完成时间标准差与空间能力的相关系数
    corr 任务完成时间标准差 空间能力
    scalar corr_sa = r(rho)

    * 重新检查任务完成时间标准差与VR熟悉程度的相关系数
    corr 任务完成时间标准差 VR熟悉程度
    scalar corr_vr = r(rho)
}
```