import {isArray, isFunction, isUndefined} from "lodash-es"
import {SubTask, TaskStatus, UseSuperTaskOptions, UseSuperTaskReturn} from "./interface";

/**
 * 使用任务队列控制任务的执行
 * @param list 任务队列
 * @param options 选项
 */
export function useSuperTask(list?:SubTask[],options:UseSuperTaskOptions={}):UseSuperTaskReturn{
    console.log('call')
    //id自增
    let seed=1;
    //执行结果
    const resultMap = new Map<number,any>();
    //任务队列状态
    let status = TaskStatus.READY
    //任务队列暂停标志
    let isPending =false;
    //任务队列重启标志
    let isRestart =false;
    //任务队列销毁标志
    let isDestroyed =false;
    //重启等待时长
    let restartWait =0;
    //当前任务下标
    let index =0;
    //任务列表
    let getTasks:SubTask[]=[];

    if(Array.isArray(list)){
        init(list)
    }


    //修改任务队列状态
    function changeStatus(v:TaskStatus){
        const oldStatus = status;
        if(status === v) return
        status =v;
        options?.onStatusChange?.call(null,v,oldStatus)
    }

    //初始化
    function init(list:SubTask[]) {
        //清除所有
        resultMap.clear()
        index=0;
        getTasks = list.map(task=>{
            const id = task?.id ?? seed++;
            return {
                id:id,
                order: task.order || id,
                wait: task.wait || 0,
                task: task.task
            }
        });
        getTasks.sort((pre,cur)=>(pre.order as number)-(cur.order as number));
    }

    //执行任务
    function executeTasks(){
        //当任务队列处于执行中、已完成、已销毁时，禁止重复执行
        if(isIn(TaskStatus.EXECUTING,TaskStatus.FINISHED,TaskStatus.DESTROYED)) return;
        if(getTasks.length ===0){
            console.warn(`[useSuperTask] hook get empty task list!`)
        }
        executeSingleTask()
    }

    //单个任务执行，递归调用
    function executeSingleTask(){
        //递归默认终止条件
        if(index<0) {
            return
        }
        if(index >= getTasks.length){
            options?.afterFn?.call(null);
            changeStatus(TaskStatus.FINISHED);
            return;
        }
        if(isIn(TaskStatus.PENDING,TaskStatus.FINISHED,TaskStatus.DESTROYED)) return;
        changeStatus(TaskStatus.EXECUTING);
        if(index === 0){
            //任务执行前应该执行的函数
            options.beforeFn?.call(null)
        }
        const task = getTasks[index];
        options?.eachBeforeFn?.(task.id as number)
        //如果指定clear，就要去移除指定的结果函数，一个任务执行依赖之前某一些任务的返回结果的清除
        if(!isUndefined(task.clear)){
            const ids = isArray(task.clear)? task.clear :[task.clear];
            ids.forEach(id=>{
                const fn = resultMap.get(id);
                isFunction(fn) && fn.call(null)
            })
        }
        const timeout =task.wait ||0
        const result = task.task.call(null);

        const p = new Promise((resolve,reject)=>{
            Promise.resolve(result).then(res=>{
                resultMap.set(task.id as number,res);
            }).finally(()=>{
                index++
                const res = resultMap.get(task.id as number);
                //执行每个任务后完成的回调
                options?.eachAfterFn?.(task.id as number,res)
                if(hasNext()){
                    setTimeout(()=>{
                        resolve(res)
                    },timeout);
                } else{
                    reject()
                }
            })
        });

        p.then(()=>{
            //执行下一个任务
            executeSingleTask()
        })


    }

    //是否需要执行下个任务
    function hasNext(){
        //任务队列重新执行
        if(isRestart){
            //执行重启
            executeRestart()
            return false
        }
        //如果任务需要销毁
        if(isDestroyed){
            executeDestroy()
            return false;
        }
        //任务需要暂停
        if(isPending){
            changeStatus(TaskStatus.PENDING);
            return false
        }
        if(index >= getTasks.length){
            options?.afterFn?.call(null);
            changeStatus(TaskStatus.FINISHED);
            return;
        }
        return true
    }

    //辅助函数
    function isIn(...tasks:TaskStatus[]){
         return tasks.includes(status)
    }
    //执行重试
    function executeRestart(){
        isRestart=false
        //清除所有
        executeClear()
        resultMap.clear()
        index =0;
        changeStatus(TaskStatus.READY)
        setTimeout(executeTasks,restartWait)
    }

    function executeClear(){
        resultMap.forEach(result=>{
            isFunction(result) && result.call(null);
        });
    }

    function executeDestroy(){
        isDestroyed=false;
        //执行销毁前回调
        options.beforeDestroy?.call(null);
        executeClear()
        //执行销毁后回调
        options.afterDestroyed?.call(null);
        changeStatus(TaskStatus.DESTROYED)
    }
    //暂停执行
    function pause(){
        isPending=true
        if(isIn(TaskStatus.READY)){
            //还没执行任务队列就被暂停，任务队列的状态设置为暂停
            changeStatus(TaskStatus.PENDING)
        }
    }

    //恢复执行
    function resume(){
        if(isIn(TaskStatus.READY)) executeTasks();
        if(isIn(TaskStatus.PENDING)){
            isPending=false
            changeStatus(TaskStatus.EXECUTING)
            executeSingleTask()
        }
    }

    //销毁所有
    function destroy(){
        //没有必要重复销毁
        if(isIn(TaskStatus.DESTROYED)) return;
        isDestroyed=true;
        if(!isIn(TaskStatus.EXECUTING)){
            executeDestroy()
        }
    }
    //重新执行任务队列
    function restart(timeout=0){
        isRestart=true
        restartWait=timeout
        if(isIn(TaskStatus.PENDING,TaskStatus.FINISHED,TaskStatus.DESTROYED)){
            executeRestart()
        }
    }

    //更新任务，以支持异步操作
    function update(tasks:SubTask[],run=false){
        if(isIn(TaskStatus.EXECUTING)) return;
        init(tasks);
        changeStatus(TaskStatus.READY)
        run && restart()
    }

    return {
        resume,
        pause,
        destroy,
        restart,
        update
    }
}
