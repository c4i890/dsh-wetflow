/** Ask the host approval service; only a recorded human grant authorizes this call. */
export async function requestUserApproval(ctx,exec,reason) {
  const service=ctx.get('approval')
  if(!exec.agent || !service) throw new Error('用户审批通道不可用，操作未执行。')
  const outcome=await service.request({agent:exec.agent,toolName:exec.name,callId:exec.callId,reason,signal:exec.signal})
  if(outcome==='allowed-once')return true
  if(outcome==='rejected'||outcome==='cancelled')return false
  throw new Error('用户审批通道不可用，操作未执行。')
}
