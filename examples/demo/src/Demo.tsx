import {useSuperTask} from "hook"
import React, {forwardRef, memo, useEffect, useImperativeHandle, useRef, useState} from "react";
import type {TableColumnsType} from "antd"
import {Button, Form, Input, InputNumber, message as $message, Modal, Table} from 'antd'
import {DeleteOutlined, PlusOutlined, ReloadOutlined} from "@ant-design/icons"
import "./demo.less"
import "antd/dist/reset.css"
import {TaskStatus} from "hook/src/interface.ts";
import cs from "classnames"

interface Task {
    id:number,
    name:string;
    timeout:number;
    //执行完毕后等待多久才执行下个任务
    wait:number;
    status:"ready"|"executing"|"finished";
    order?:number
}

let seed=1

//初始化任务数据
function initTask(count=4):Task[]{
    return new Array(count).fill(0).map((_,index)=>({
        id:seed++,
        name:'任务'+(index+1),
        status:'ready',
        wait:3000,
        timeout:2000
    }))
}

interface TaskListProps {
    onChangeTasks:(tasks:Task[])=>void;
    onChangeStatus?:(status:TaskStatus)=>void
}

interface TaskListRef {
    updateTasks:(tasks:Task[])=>void;
    updateMessage:(message:string)=>void
    updateStatus:(status:TaskStatus)=>void
    openModel:()=>void
}

//任务看板
const TaskList=forwardRef<TaskListRef,TaskListProps>(({onChangeTasks},ref)=>{
    const [tasks,setTasks] = useState(()=>initTask(4));
    const [status,setStatus]=useState<TaskStatus>(TaskStatus.READY);
    const [taskMessage,setTaskMessage] = useState('任务队列准备中...');
    const [open,setOpen] =useState(false)
    useImperativeHandle(ref,()=>{
        return {
            updateTasks(tasks){
               setTasks(tasks)
            },
            updateMessage(message){
                setTaskMessage(message)
            },
            updateStatus(v){
                setStatus(v)
            },
            openModel(){
                setOpen(true)
            }
        }
    });
    const columns:TableColumnsType<Task> = [
        {
            title: '任务名称',
            dataIndex: 'name',
            key: 'name'
        },
        {
            title:'响应时间(ms)',
            dataIndex:'timeout',
            key:'timeout'
        },
        {
            title:'等待时间(ms)',
            dataIndex:'wait',
            key:'wait'
        },
        {
            title:"当前任务状态",
            dataIndex:"status",
            key:'status',
            render(status:Task['status']){
                return <FormatStatus status={status}/>
            }
        }
    ];

    useEffect(() => {
        onChangeTasks?.(tasks)
    }, [tasks]);

    return (
        <div className={'task-box'}>
            <div className="task-title">
                <h3 className="title">任务看板</h3>
            </div>
            <div className="task-info">
                <div className="info">
                    <div>任务队列状态：</div>
                    <FormatListStatus status={status}/>
                </div>
                <div className="message">
                    <div>任务队列消息：</div>
                    <div style={{color:'skyblue'}}>{taskMessage}</div>
                </div>
            </div>
            <AddModal tasks={tasks} open={open} onClose={() => setOpen(false)} onSubmit={(task) => {
                const list:Task[] = tasks.map(task=>({
                    ...task,
                    status:'ready'
                }));
                list.push({...task, id: Date.now(),status:'ready'})
                setTasks(list);
            }}/>
            <Table rowKey="id" bordered pagination={false} dataSource={tasks} columns={columns} scroll={{y:350}}></Table>
        </div>
    )
})

//任务状态格式化
const FormatListStatus:React.FC<{status:TaskStatus}>=({status})=>{
    switch (status){
        case TaskStatus.READY:
            return <div className={'format-item format-ready'}>准备中</div>
        case TaskStatus.EXECUTING:
            return <div className={'format-item format-executing'}>执行中</div>
        case TaskStatus.PENDING:
            return <div className={'format-item format-pending'}>暂停</div>
        case TaskStatus.FINISHED:
            return <div className={'format-item format-finished'}>执行完成</div>
        case TaskStatus.DESTROYED:
            return <div className={'format-item format-destroyed'}>销毁</div>
    }
}

//格式化
const FormatStatus: React.FC<{ status: Task['status'] }> = ({status}) => {
    switch (status) {
        case "ready":
            return <div className={'format-item format-ready'}>准备中</div>
        case "executing":
            return <div className={'format-item format-executing'}>执行中</div>
        case 'finished':
            return <div className={'format-item format-finished'}>执行完毕</div>
    }
}

interface AddModalProps {
    open:boolean,
    onSubmit?:(task:Task)=>void,
    onClose?:()=>void
    tasks:Task[]
}

//新增任务面版
const AddModal:React.FC<AddModalProps>=({tasks,open,onSubmit,onClose})=>{
    const [addTaskForm]=Form.useForm();
    useEffect(() => {
        if(open){
            addTaskForm.resetFields()
        }
    }, [open]);
    return (
        <Modal title='新增任务' width="400px" open={open} onCancel={()=>{
            onClose?.()
        }} footer={()=>(<>
            <Button danger onClick={()=>{
                onClose?.()
            }}>取消</Button>
            <Button type="primary" onClick={()=>{
                addTaskForm.submit();
                onClose?.()
            }}>确认新增</Button>
        </>)}>
            <Form className="add-task-form"
                  name='add_task'
                  layout="vertical"
                  labelCol={{ span: 12 }}
                  wrapperCol={{ span: 16 }}
                  style={{ maxWidth: 600 }}
                  autoComplete="off"
                  initialValues={{name:'',timeout:3000,wait:0}}
                  form={addTaskForm}
                  onFinish={(values)=>{
                      onSubmit?.({...values,status:'ready'})
                  }}
            >
                <Form.Item<Task> label="任务名称" name='name' rules={[
                    {
                        validator(_,value){
                            if(!value) return Promise.reject('任务名称必填');
                            const taskNames = tasks.map(task=>task.name);
                            if(taskNames.includes(value)) return Promise.reject('任务名称已存在');
                            return Promise.resolve(value)
                        }
                    }
                ]}>
                    <Input/>
                </Form.Item>
                <Form.Item<Task> label="任务响应时间" tooltip="该异步任务执行到结束的时长" name='timeout' rules={[{required:true,message:'任务响应时间必填'}]}>
                    <InputNumber style={{width:"100%"}} min={0} step={500} addonAfter={(<div>ms</div>)}/>
                </Form.Item>
                <Form.Item<Task> label="任务等待时间(ms)" tooltip="当前任务执行完毕后等待多久才执行下个任务" name='wait' rules={[{required:true,message:'任务等待时间必填'}]}>
                    <InputNumber style={{width:"100%"}} min={0} step={50} addonAfter={(<div>ms</div>)}/>
                </Form.Item>
            </Form>
        </Modal>
    )
}

const MenoTaskList = memo(TaskList);

interface ToolbarProps{
    onOperate:(type:string)=>void
}

interface ToolbarRef {
    updateStatus:(status:TaskStatus)=>void
    updateFirst:(first:boolean)=>void;
}
const Toolbar=forwardRef<ToolbarRef,ToolbarProps>(({onOperate},ref)=>{
    const [status,setStatus] = useState<TaskStatus>(TaskStatus.READY)
    useImperativeHandle(ref,()=>{
        return {
            updateStatus(status:TaskStatus){
                setStatus(status)
            },
            updateFirst(v:boolean){
                setIsFirst(v)
            }
        }
    });
    const [isFirst,setIsFirst] = useState(true);
    function isIn(...statuses:TaskStatus[]){
        return statuses.includes(status)
    }
    return (
        <div className={'toolbar-box'}>
            <h4>工具栏</h4>
            <div className={
                cs("toolbar-item", {
                    "hidden": isIn(TaskStatus.EXECUTING, TaskStatus.PENDING)
                })
            }>
                <Button type="primary" onClick={() => {
                    onOperate?.('add')
                }}><PlusOutlined/>新增任务</Button>
            </div>
            <div className={
                cs("toolbar-item", {
                    "hidden": isIn(TaskStatus.EXECUTING, TaskStatus.PENDING)
                })
            }>
                <Button danger onClick={() => {
                    onOperate?.('delete')
                }}><DeleteOutlined/>删除任务</Button>
            </div>
            <div className={
                cs("toolbar-item",{
                    'hidden':!isFirst
                })
            }>
                <Button type="primary" onClick={() => {
                    onOperate?.('start')
                }}>开始执行</Button>
            </div>
            <div className={
                cs("toolbar-item", {
                    'hidden': !isIn(TaskStatus.PENDING)
                })
            }>
                <Button color="gray" onClick={() => {
                    onOperate?.('resume')
                }}>恢复</Button>
            </div>
            <div className={cs('toolbar-item', {
                'hidden': isIn(TaskStatus.READY,TaskStatus.PENDING,TaskStatus.FINISHED,TaskStatus.DESTROYED)
            })}>
                <Button danger onClick={() => {
                    onOperate?.('pause')
                }}>暂停</Button>
            </div>
            <div className={cs('toolbar-item', {
                'hidden': isIn(TaskStatus.READY)
            })}>
                <Button onClick={() => {
                    onOperate?.('restart')
                }}><ReloadOutlined/>重新执行</Button>
            </div>
            <div className={cs('toolbar-item', {
                'hidden': isIn(TaskStatus.DESTROYED)
            })}>
                <Button danger onClick={() => {
                    onOperate?.('destroy')
                }}>销毁</Button>
            </div>

        </div>
    )
})

const Demo: React.FC = () => {

    const taskListRef = useRef<TaskListRef>(null);
    const toolbarRef = useRef<ToolbarRef>(null);
    // useEffect(() => {
    //     console.log('render')
    // });

    function getTaskList(tasks: Task[]) {
        return tasks.map(task => {
            const fn = () => {
                return new Promise((resolve, reject) => {
                    try {
                        task.status = "executing"
                        setTimeout(() => {
                            task.status = "finished";
                            resolve(null)
                        }, task.timeout)
                    } catch (e) {
                        reject(e)
                    }
                })
            };
            return {
                id: task.id,
                task: fn,
                wait: task.wait
            }
        })
    }

    function getTaskNameById(id: number, tasks: Task[]) {
        return (tasks.find(task => task.id === id) ?? {name: ""}).name
    }

    let tasks: Task[] = []
    let curStatus :TaskStatus=TaskStatus.READY

    const {resume, pause, restart, update,destroy} = useSuperTask(getTaskList(tasks), {
        beforeFn() {
            taskListRef.current!.updateMessage('任务队列准备中');
            tasks.forEach(task => {
                task.status = 'ready'
            });
            taskListRef.current!.updateTasks(tasks)
        },
        eachBeforeFn(id) {
            const taskName = getTaskNameById(id, tasks)
            taskListRef.current!.updateMessage(`任务【${taskName}】开始执行`)
        },
        eachAfterFn(taskId){
            const taskName = getTaskNameById(taskId,tasks)
            taskListRef.current!.updateMessage(`任务【${taskName}】执行完毕`)
        },
        afterFn(){
            taskListRef.current!.updateMessage('任务队列执行完毕')
        },
        onStatusChange(status,oldStatus){
            taskListRef.current!.updateStatus(status)
            toolbarRef.current!.updateStatus(status);
            curStatus = status
            if(status === TaskStatus.PENDING){
                taskListRef.current!.updateMessage('任务队列暂停')
            }
            if(status!==TaskStatus.PENDING && oldStatus === TaskStatus.PENDING){
                taskListRef.current!.updateMessage('任务队列恢复执行')
            }
            if(status === TaskStatus.READY){
                taskListRef.current!.updateMessage('任务队列准备中');
            }
            if(status === TaskStatus.DESTROYED){
                taskListRef.current!.updateMessage('任务队列已销毁')
            }
        }
    })

    return <div className={'demo-box'}>
        <MenoTaskList ref={taskListRef}  onChangeTasks={(list)=>{
            tasks =list;
            update(getTaskList(list));
            toolbarRef.current!.updateFirst(true)
        }}/>
        <Toolbar ref={toolbarRef} onOperate={(type)=>{
            switch (type) {
                case 'start':
                case 'resume':
                    if(curStatus === TaskStatus.DESTROYED) $message.warning('任务队列已销毁')
                    resume()
                    toolbarRef.current!.updateFirst(false)
                    break
                case 'pause':
                    pause()
                    break
                case 'add':
                    taskListRef.current!.openModel()
                    break
                case 'delete':
                    if(tasks.length <=1){
                        $message.warning('任务队列不得为空')
                        return;
                    }
                    const temp =[...tasks];
                    temp.pop()
                    tasks = temp.map((task)=>({
                        ...task,
                        status:'ready'
                    }));
                    update(getTaskList(tasks));
                    toolbarRef.current!.updateFirst(true)
                    taskListRef.current!.updateTasks(tasks);
                    break
                case 'restart':
                    restart()
                    break
                case "destroy":
                    destroy()
                    break

            }
        }}/>
    </div>
}
export default Demo